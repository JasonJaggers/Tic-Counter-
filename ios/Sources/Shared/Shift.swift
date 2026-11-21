import Foundation

enum ShiftError: LocalizedError {
    case invalidReading, unavailable, maximum, existingData
    var errorDescription: String? {
        switch self {
        case .invalidReading: return "Enter a number within the allowed range."
        case .unavailable: return "Sterling storage is unavailable. Check the App Group configuration."
        case .maximum: return "This counter has reached its maximum."
        case .existingData: return "Import requires an empty workspace. Export a backup before replacing any records."
        }
    }
}

struct Readings: Codable, Equatable {
    var counts: [String: Int] = [:]
    var pounds = ""
    var amd = ""
    var levels: [String: String] = [:]
}

struct Snapshot: Codable, Identifiable {
    var id = UUID()
    var date = Date()
    var readings: Readings
    var originalTimestamp: String? = nil
}

struct CountChange: Codable {
    var name: String
    var previous: Int
}

struct Shift: Codable {
    static let counts = ["Mix 1", "Mix 2", "Mix 3", "AA", "NA", "AN"]
    static let levels = ["AMD", "AA", "NA", "AN"]
    static let group = "group.com.jasonjaggers.sterling"
    static let personalGroup = "group.com.jasonjaggers.sterling.personal"
    var readings = Readings()
    var archives: [Snapshot] = []
    var countUndo: [CountChange] = []
    var levelUndo: [String: String]?
    var bbsDay: String?
    var reportDay: String?
    var draft = ""
    var convertedWidgetPounds: Double?

    static func workday(_ date: Date = Date()) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Chicago")!
        let time = calendar.dateComponents([.hour, .minute], from: date)
        let day = (time.hour ?? 0) * 60 + (time.minute ?? 0) < 370
            ? calendar.date(byAdding: .day, value: -1, to: date) ?? date : date
        let parts = calendar.dateComponents([.year, .month, .day], from: day)
        return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
    }

    mutating func add(_ name: String) throws {
        guard Self.counts.contains(name) else { throw ShiftError.invalidReading }
        let count = readings.counts[name, default: 0]
        guard count < 9_007_199_254_740_991 else { throw ShiftError.maximum }
        readings.counts[name] = count + 1
        countUndo = Array((countUndo + [CountChange(name: name, previous: count)]).suffix(30))
    }

    mutating func undoCount() {
        guard let change = countUndo.popLast() else { return }
        readings.counts[change.name] = change.previous
    }

    mutating func setLevel(_ name: String, _ value: String) throws {
        guard Self.levels.contains(name) else { throw ShiftError.invalidReading }
        let value = try Self.reading(value, maximum: 99)
        guard readings.levels[name, default: ""] != value else { return }
        levelUndo = readings.levels
        readings.levels[name] = value
    }

    mutating func undoLevels() {
        guard let previous = levelUndo else { return }
        readings.levels = previous
        levelUndo = nil
    }

    mutating func reset(levels: Bool) {
        archives = Array(([Snapshot(readings: readings)] + archives).prefix(120))
        if levels {
            levelUndo = readings.levels
            readings.levels = [:]
        } else {
            readings.counts = [:]
            readings.pounds = ""
            readings.amd = ""
            countUndo = []
        }
    }

    static func kilograms(from pounds: Double) -> Int? {
        guard pounds.isFinite, pounds >= 0 else { return nil }
        return Int(exactly: ceil(pounds / 2.205))
    }

    static func reading(_ text: String, maximum: Double = .greatestFiniteMagnitude) throws -> String {
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
        guard !value.isEmpty else { return "" }
        guard let number = Double(value), number.isFinite, (0...maximum).contains(number) else {
            throw ShiftError.invalidReading
        }
        return value
    }

    func share(levels: Bool) -> String {
        if levels {
            return Self.levels.compactMap { name in
                let value = readings.levels[name, default: ""]
                return (Double(value) ?? 0) > 0 ? "\(name): \(value)%" : nil
            }.joined(separator: "\n")
        }
        var lines = Self.counts.compactMap { name -> String? in
            let count = readings.counts[name, default: 0]
            return count > 0 ? "\(name): \(count)" : nil
        }
        if let pounds = Double(readings.pounds), pounds > 0 {
            lines.append("Hold: \(pounds.formatted(.number.locale(Locale(identifier: "en_US")))) lb")
        }
        if (Double(readings.amd) ?? 0) > 0 { lines.append("AMD: \(readings.amd)%") }
        return lines.joined(separator: "\n")
    }

    func csv(_ date: Date = Date()) -> String {
        let header = ["Timestamp", "Mix 1", "Mix 2", "Mix 3", "Pounds", "AMD %", "AA", "NA", "AN"]
        let values = Self.counts.map { String(readings.counts[$0, default: 0]) }
        let row = [ISO8601DateFormatter().string(from: date)] + Array(values.prefix(3))
            + [readings.pounds, readings.amd] + Array(values.suffix(3))
        return [header, row].map { columns in
            columns.map { value in
                let safe = value.first.map { "=+@\t\r".contains($0) } == true ? "'" + value : value
                return "\"" + safe.replacingOccurrences(of: "\"", with: "\"\"") + "\""
            }.joined(separator: ",")
        }.joined(separator: "\r\n")
    }
}

struct ShiftStore {
    let directory: URL
    var file: URL { directory.appendingPathComponent("shift.json") }

    static func shared() throws -> ShiftStore {
        #if os(iOS) && STERLING_PERSONAL
        let store = try personalWidget()
        let url = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                              appropriateFor: nil, create: true)
        try store.initialize(from: ShiftStore(directory: url))
        return store
        #elseif os(iOS)
        guard let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shift.group) else {
            throw ShiftError.unavailable
        }
        return ShiftStore(directory: url)
        #else
        throw ShiftError.unavailable
        #endif
    }

    #if os(iOS)
    static func personalWidget() throws -> ShiftStore {
        guard let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Shift.personalGroup) else {
            throw ShiftError.unavailable
        }
        return ShiftStore(directory: url)
    }
    #endif

    func initialize(from oldStore: ShiftStore) throws {
        guard !FileManager.default.fileExists(atPath: file.path) else { return }
        try withLock {
            guard !FileManager.default.fileExists(atPath: file.path) else { return }
            let oldShift = try oldStore.read()
            try JSONEncoder().encode(oldShift).write(to: file, options: .atomic)
        }
    }

    func read() throws -> Shift {
        do { return try JSONDecoder().decode(Shift.self, from: Data(contentsOf: file)) }
        catch let error as CocoaError where error.code == .fileReadNoSuchFile { return Shift() }
    }

    @discardableResult
    func update(requiresExisting: Bool = false, _ edit: (inout Shift) throws -> Void) throws -> Shift {
        try withLock {
            if requiresExisting && !FileManager.default.fileExists(atPath: file.path) {
                throw ShiftError.unavailable
            }
            var shift = try read()
            try edit(&shift)
            try JSONEncoder().encode(shift).write(to: file, options: .atomic)
            return shift
        }
    }

    private func withLock<T>(_ operation: () throws -> T) throws -> T {
        let path = directory.appendingPathComponent("shift.lock").path
        let descriptor = open(path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { throw ShiftError.unavailable }
        defer { close(descriptor) }
        while flock(descriptor, LOCK_EX) != 0 {
            guard errno == EINTR else { throw ShiftError.unavailable }
        }
        defer { flock(descriptor, LOCK_UN) }
        return try operation()
    }
}

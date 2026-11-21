import Foundation

@main
struct ShiftChecks {
    static func main() throws {
        let date = ISO8601DateFormatter()
        precondition(Shift.workday(date.date(from: "2026-03-08T11:09:00Z")!) == "2026-03-07")
        precondition(Shift.workday(date.date(from: "2026-03-08T11:10:00Z")!) == "2026-03-08")
        var shift = Shift()
        try shift.add("Mix 1")
        try shift.add("Mix 1")
        shift.undoCount()
        precondition(shift.share(levels: false) == "Mix 1: 1")
        try shift.setLevel("AA", "9,5")
        precondition(shift.share(levels: true) == "AA: 9.5%")
        shift.reset(levels: true)
        precondition(shift.archives.first?.readings.levels["AA"] == "9.5")
        shift.undoLevels()
        precondition(shift.readings.levels["AA"] == "9.5")
        precondition(shift.csv().contains("\"Timestamp\",\"Mix 1\""))
        let backup = try JSONEncoder().encode([
            "format": "sterling-web-backup-v1"
        ])
        precondition((try? LegacyBackup.decode(backup)) == nil)
        let valid = try JSONSerialization.data(withJSONObject: [
            "format": "sterling-web-backup-v1",
            "values": ["tank-counter-v1": #"{"counts":{"Mix 2":7},"pounds":"150","amd":"12"}"#]
        ])
        let migrated = try LegacyBackup.decode(valid)
        precondition(migrated.readings.counts["Mix 2"] == 7)
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: false)
        defer { try? FileManager.default.removeItem(at: dir) }
        let store = ShiftStore(directory: dir)
        DispatchQueue.concurrentPerform(iterations: 100) { _ in
            do { try store.update { try $0.add("Mix 3") } }
            catch { fatalError(error.localizedDescription) }
        }
        let stored = try store.read()
        precondition(stored.readings.counts["Mix 3"] == 100)
        precondition(stored.countUndo.count == 30)
        precondition(Shift.kilograms(from: 2.205) == 1)
        precondition(Shift.kilograms(from: 3) == 2)
        precondition(Shift.kilograms(from: -.infinity) == nil)

        let sharedDirectory = dir.appendingPathComponent("shared", isDirectory: true)
        try FileManager.default.createDirectory(at: sharedDirectory, withIntermediateDirectories: false)
        let shared = ShiftStore(directory: sharedDirectory)
        do {
            try shared.update(requiresExisting: true) { try $0.add("AA") }
            fatalError("Widget wrote before the legacy store was migrated")
        } catch ShiftError.unavailable {}
        try shared.initialize(from: store)
        let migratedStore = try shared.read()
        precondition(migratedStore.readings.counts["Mix 3"] == 100)
        try shared.update(requiresExisting: true) { try $0.add("AA") }
        try shared.initialize(from: store)
        let updated = try shared.read()
        precondition(updated.readings.counts["AA"] == 1)
        let original = try store.read()
        precondition(original.readings.counts["AA"] == nil)
        print("Sterling model and widget migration checks passed")
    }
}

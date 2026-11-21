import Foundation

struct NativeBackup: Codable {
    var format = "sterling-native-backup-v1"
    let shift: Shift
}

enum LegacyBackup {
    struct Envelope: Decodable {
        let format: String
        let values: [String: String]
    }

    struct Counts: Decodable {
        let counts: [String: Int]?
        let pounds: String?
        let amd: String?
    }

    struct Archive: Decodable {
        let created: String
        let counts: [String: Int]
        let hold: String
        let amd: String
        let levels: [String: String]
    }

    static func decode(_ data: Data) throws -> Shift {
        let decoder = JSONDecoder()
        if let native = try? decoder.decode(NativeBackup.self, from: data),
           native.format == "sterling-native-backup-v1" {
            let shift = native.shift
            let snapshots = [shift.readings] + shift.archives.map(\.readings)
            guard shift.archives.count <= 120, shift.countUndo.count <= 30,
                  shift.countUndo.allSatisfy({ Shift.counts.contains($0.name) && (0...9_007_199_254_740_991).contains($0.previous) })
            else { throw ShiftError.invalidReading }
            for reading in snapshots {
                guard reading.counts.allSatisfy({ Shift.counts.contains($0.key) && (0...9_007_199_254_740_991).contains($0.value) })
                else { throw ShiftError.invalidReading }
                _ = try Shift.reading(reading.pounds)
                _ = try Shift.reading(reading.amd, maximum: 100)
                for (name, value) in reading.levels {
                    guard Shift.levels.contains(name) else { throw ShiftError.invalidReading }
                    _ = try Shift.reading(value, maximum: 99)
                }
            }
            if let levels = shift.levelUndo {
                for (name, value) in levels {
                    guard Shift.levels.contains(name) else { throw ShiftError.invalidReading }
                    _ = try Shift.reading(value, maximum: 99)
                }
            }
            return shift
        }
        let envelope = try decoder.decode(Envelope.self, from: data)
        guard envelope.format == "sterling-web-backup-v1" else { throw ShiftError.invalidReading }
        func value<T: Decodable>(_ type: T.Type, _ key: String) throws -> T? {
            guard let value = envelope.values[key] else { return nil }
            return try decoder.decode(type, from: Data(value.utf8))
        }
        func readings(_ counts: [String: Int], _ pounds: String, _ amd: String, _ levels: [String: String]) throws -> Readings {
            var result = Readings()
            for name in Shift.counts {
                let n = counts[name, default: 0]
                guard (0...9_007_199_254_740_991).contains(n) else { throw ShiftError.invalidReading }
                if n > 0 { result.counts[name] = n }
            }
            result.pounds = try Shift.reading(pounds)
            result.amd = try Shift.reading(amd, maximum: 100)
            for name in Shift.levels {
                let level = try Shift.reading(levels[name, default: ""], maximum: 99)
                if !level.isEmpty { result.levels[name] = level }
            }
            return result
        }

        var shift = Shift()
        let counts = try value(Counts.self, "tank-counter-v1")
        let levels = try value([String: String].self, "sterling-line1-levels-v1") ?? [:]
        shift.readings = try readings(counts?.counts ?? [:], counts?.pounds ?? "", counts?.amd ?? "", levels)
        let history = try value([Archive].self, "sterling-v2-archives") ?? []
        shift.archives = try history.prefix(120).map {
            Snapshot(readings: try readings($0.counts, $0.hold, $0.amd, $0.levels), originalTimestamp: $0.created)
        }
        shift.bbsDay = envelope.values["sterling-specialty-bbs-selected-v1"]
        shift.reportDay = envelope.values["sterling-specialty-report-selected-v1"]
        return shift
    }
}

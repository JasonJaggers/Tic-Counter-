import AppIntents
import WidgetKit

enum SterlingCounter: String, AppEnum {
    case mix1 = "Mix 1"
    case mix2 = "Mix 2"
    case mix3 = "Mix 3"
    case aa = "AA"
    case na = "NA"
    case an = "AN"

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Sterling counter"
    static let caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .mix1: "Mix 1", .mix2: "Mix 2", .mix3: "Mix 3",
        .aa: "AA", .na: "NA", .an: "AN"
    ]
}

struct AddSterlingCountIntent: AppIntent {
    static let title: LocalizedStringResource = "Add One to Sterling Counter"
    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    @Parameter(title: "Counter") var counter: SterlingCounter

    static var parameterSummary: some ParameterSummary {
        Summary("Add one to \(\.$counter)")
    }

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let name = counter.rawValue
        let shift = try ShiftStore.shared().update { try $0.add(name) }
        WidgetCenter.shared.reloadAllTimelines()
        let count = shift.readings.counts[name, default: 0]
        return .result(dialog: "\(name) is now \(count).")
    }
}

struct GetSterlingTotalsIntent: AppIntent {
    static let title: LocalizedStringResource = "Get Sterling Totals"
    static let description = IntentDescription("Returns the current counts and readings as text for Shortcuts.")
    static let authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication

    @Parameter(title: "Tank Levels Only", default: false) var tankLevelsOnly: Bool

    static var parameterSummary: some ParameterSummary {
        Summary("Get Sterling totals") {
            \.$tankLevelsOnly
        }
    }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let shift = try ShiftStore.shared().read()
        let message = try shift.totalsForMessage(tankLevelsOnly: tankLevelsOnly)
        return .result(value: message, dialog: "\(message)")
    }
}

struct SterlingAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: AddSterlingCountIntent(), phrases: [
            "Add one to \(\.$counter) in \(.applicationName)",
            "Log \(\.$counter) in \(.applicationName)"
        ], shortTitle: "Add a Count", systemImageName: "plus")
        AppShortcut(intent: GetSterlingTotalsIntent(), phrases: [
            "Get my \(.applicationName) totals",
            "What's my \(.applicationName) status"
        ], shortTitle: "Get Totals", systemImageName: "list.number")
    }
}

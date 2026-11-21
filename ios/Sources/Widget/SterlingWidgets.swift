import AppIntents
import SwiftUI
import WidgetKit

struct AddCounter: AppIntent {
    static let title: LocalizedStringResource = "Add to Sterling counter"
    @Parameter(title: "Counter") var counter: String

    init() {}
    init(_ counter: String) { self.counter = counter }

    func perform() async throws -> some IntentResult {
        try ShiftStore.shared().update { try $0.add(counter) }
        WidgetCenter.shared.reloadTimelines(ofKind: "SterlingShift")
        return .result()
    }
}

struct ShiftEntry: TimelineEntry {
    let date: Date
    let shift: Shift?
}

struct ShiftProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShiftEntry {
        var shift = Shift()
        shift.readings.counts = ["Mix 1": 3, "Mix 2": 2, "Mix 3": 1, "AA": 1]
        return ShiftEntry(date: .now, shift: shift)
    }

    func getSnapshot(in context: Context, completion: @escaping (ShiftEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : current())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShiftEntry>) -> Void) {
        let entry = current()
        completion(Timeline(entries: [entry], policy: .after(entry.date.addingTimeInterval(30 * 60))))
    }

    private func current() -> ShiftEntry {
        ShiftEntry(date: .now, shift: try? ShiftStore.shared().read())
    }
}

struct ShiftWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ShiftEntry
    private let background = Color(red: 12/255, green: 18/255, blue: 28/255)
    private let mint = Color(red: 162/255, green: 228/255, blue: 213/255)

    var body: some View {
        Group {
            if family == .accessoryCircular {
                Image("Brand", bundle: .main)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 36, height: 36)
                    .clipShape(.rect(cornerRadius: 5))
                    .accessibilityLabel("Open Sterling")
            } else {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Sterling").font(.headline).foregroundStyle(mint)
                    if let shift = entry.shift {
                        row(Array(Shift.counts.prefix(3)), shift: shift)
                        if family == .systemMedium { row(Array(Shift.counts.suffix(3)), shift: shift) }
                    } else {
                        Text("Open Sterling to check storage.").font(.caption)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .foregroundStyle(.white)
            }
        }
        .containerBackground(background, for: .widget)
        .widgetURL(URL(string: "sterling://counters"))
    }

    private func row(_ names: [String], shift: Shift) -> some View {
        HStack(spacing: 4) {
            ForEach(names, id: \.self) { name in
                let count = shift.readings.counts[name, default: 0]
                Button(intent: AddCounter(name)) {
                    VStack(spacing: 1) {
                        Text(name).font(.caption2).lineLimit(1).minimumScaleFactor(0.75)
                        HStack(spacing: 3) {
                            Text(count.formatted()).font(.subheadline.weight(.semibold)).monospacedDigit().lineLimit(1)
                            Image(systemName: "plus").font(.caption2)
                        }
                    }.frame(maxWidth: .infinity, minHeight: 40)
                    .background(.white.opacity(0.12), in: .rect(cornerRadius: 7))
                }
                .buttonStyle(.plain)
                .privacySensitive()
                .accessibilityLabel("Add one to \(name), currently \(count)")
            }
        }
    }
}

@main
struct SterlingWidgets: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SterlingShift", provider: ShiftProvider()) { entry in
            ShiftWidgetView(entry: entry)
        }
        .configurationDisplayName("Sterling Counters")
        .description("Add mixes and unloads from the Home Screen or open Sterling from the Lock Screen.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular])
    }
}

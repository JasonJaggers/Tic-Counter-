import AppIntents
import SwiftUI
import WidgetKit

struct LogSterlingCount: AppIntent {
    static let title: LocalizedStringResource = "Log Sterling count"
    static let openAppWhenRun = false
    @Parameter(title: "Counter") var counter: String

    init() {}
    init(_ counter: String) { self.counter = counter }

    func perform() async throws -> some IntentResult {
        try ShiftStore.personalWidget().update(requiresExisting: true) { try $0.add(counter) }
        return .result()
    }
}

struct EnterWidgetPoundsKey: AppIntent {
    static let title: LocalizedStringResource = "Enter a Sterling converter key"
    static let isDiscoverable = false
    @Parameter(title: "Key") var key: String

    init() {}
    init(_ key: String) { self.key = key }

    func perform() async throws -> some IntentResult {
        try ShiftStore.personalWidget().update(requiresExisting: true) {
            try $0.enterWidgetPoundsKey(key)
        }
        return .result()
    }
}

struct SterlingWidgetOptions: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Sterling Counters"
}

struct CounterEntry: TimelineEntry {
    let date: Date
    let counts: [String: Int]?
}

struct CounterProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> CounterEntry {
        CounterEntry(date: .now, counts: ["Mix 2": 1])
    }

    func snapshot(for configuration: SterlingWidgetOptions, in context: Context) async -> CounterEntry {
        context.isPreview ? placeholder(in: context) : current()
    }

    func timeline(for configuration: SterlingWidgetOptions, in context: Context) async -> Timeline<CounterEntry> {
        Timeline(entries: [current()], policy: .never)
    }

    private func current() -> CounterEntry {
        let store = try? ShiftStore.personalWidget()
        let shift = store.flatMap { store -> Shift? in
            guard FileManager.default.fileExists(atPath: store.file.path) else { return nil }
            return try? store.read()
        }
        return CounterEntry(date: .now, counts: shift?.readings.counts)
    }
}

struct SterlingCounterWidget: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var renderingMode
    let entry: CounterEntry
    private let counters = URL(string: "sterling-personal://counters")!
    private let background = Color(red: 12/255, green: 18/255, blue: 28/255)
    private let card = Color(red: 20/255, green: 30/255, blue: 44/255)
    private let action = Color(red: 35/255, green: 59/255, blue: 87/255)
    private let mint = Color(red: 162/255, green: 228/255, blue: 213/255)

    private var isAccented: Bool { renderingMode == .accented }
    private var labelColor: Color { isAccented ? .primary : .white.opacity(0.7) }
    private var highlightColor: Color { isAccented ? .primary : mint }

    var body: some View {
        Group {
            if family == .accessoryCircular {
                Image("Brand", bundle: .main)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 36, height: 36)
                    .clipShape(.rect(cornerRadius: 5))
                    .accessibilityLabel("Open Sterling")
            } else if let counts = entry.counts {
                VStack(spacing: family == .systemLarge ? 10 : 5) {
                    row(Array(Shift.counts.prefix(3)), counts: counts)
                    row(Array(Shift.counts.suffix(3)), counts: counts)
                }
            } else {
                Link(destination: counters) {
                    Label("Open Sterling once to load your counters", systemImage: "number")
                }.foregroundStyle(highlightColor)
            }
        }
        .widgetURL(counters)
        .containerBackground(background, for: .widget)
    }

    private func row(_ names: [String], counts: [String: Int]) -> some View {
        HStack(spacing: family == .systemLarge ? 8 : 5) {
            ForEach(names, id: \.self) { name in
                let count = counts[name, default: 0]
                if family == .systemLarge {
                    VStack(spacing: 5) {
                        Text(name.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(labelColor)
                        Spacer(minLength: 0)
                        Text(count == 0 ? " " : count.formatted()).font(.title.weight(.semibold))
                            .monospacedDigit().lineLimit(1).minimumScaleFactor(0.5)
                            .foregroundStyle(isAccented ? Color.primary : .white).privacySensitive()
                        Spacer(minLength: 0)
                        increment(name, count: count) {
                            Image(systemName: "plus").font(.title3.weight(.semibold))
                                .frame(maxWidth: .infinity, minHeight: 39)
                                .background { panel(action, radius: 8) }
                        }
                    }
                    .padding(7)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background { panel(card, radius: 12) }
                } else {
                    increment(name, count: count) {
                        VStack(spacing: 2) {
                            Text(name.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(labelColor)
                            HStack(spacing: 4) {
                                Text(count.formatted()).lineLimit(1).minimumScaleFactor(0.5)
                                Image(systemName: "plus")
                            }.font(.caption.weight(.semibold)).monospacedDigit()
                        }
                        .frame(maxWidth: .infinity, minHeight: 41)
                        .background { panel(card, radius: 8) }
                    }
                }
            }
        }
    }

    @ViewBuilder private func panel(_ fill: Color, radius: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius)
        if isAccented {
            shape.strokeBorder(Color.primary.opacity(0.32), lineWidth: 1)
        } else {
            shape.fill(fill)
        }
    }

    private func increment<Label: View>(_ name: String, count: Int, @ViewBuilder label: () -> Label) -> some View {
        Button(intent: LogSterlingCount(name), label: label)
            .buttonStyle(.plain).foregroundStyle(isAccented ? Color.primary : .white)
            .accessibilityLabel("Add one to \(name), currently \(count)")
            .privacySensitive()
    }
}

struct SterlingCountersWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "SterlingPersonalShortcuts", intent: SterlingWidgetOptions.self, provider: CounterProvider()) {
            SterlingCounterWidget(entry: $0)
        }
        .configurationDisplayName("Sterling Counters")
        .description("Log mixes and unloads directly from the Home Screen.")
        .supportedFamilies([.systemMedium, .systemLarge, .accessoryCircular])
    }
}

struct ConverterEntry: TimelineEntry {
    let date: Date
    let input: String?
}

struct ConverterProvider: TimelineProvider {
    func placeholder(in context: Context) -> ConverterEntry {
        ConverterEntry(date: .now, input: "100")
    }

    func getSnapshot(in context: Context, completion: @escaping (ConverterEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : current())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ConverterEntry>) -> Void) {
        completion(Timeline(entries: [current()], policy: .never))
    }

    private func current() -> ConverterEntry {
        guard let store = try? ShiftStore.personalWidget(),
              FileManager.default.fileExists(atPath: store.file.path),
              let shift = try? store.read() else {
            return ConverterEntry(date: .now, input: nil)
        }
        return ConverterEntry(date: .now, input: shift.widgetPoundsInput ?? "")
    }
}

struct SterlingConverterView: View {
    @Environment(\.widgetRenderingMode) private var renderingMode
    let entry: ConverterEntry
    private let action = Color(red: 35/255, green: 59/255, blue: 87/255)
    private var labelColor: Color { renderingMode == .accented ? .primary : .white.opacity(0.85) }
    private var highlightColor: Color {
        renderingMode == .accented ? .primary : Color(red: 162/255, green: 228/255, blue: 213/255)
    }
    private var isAccented: Bool { renderingMode == .accented }

    var body: some View {
        Group {
            if let input = entry.input {
                keypad(input)
            } else {
                Link("Open Sterling to set up the converter",
                     destination: URL(string: "sterling-personal://convert")!)
                    .foregroundStyle(labelColor)
            }
        }
        .containerBackground(Color(red: 12/255, green: 18/255, blue: 28/255), for: .widget)
    }

    private func keypad(_ input: String) -> some View {
        VStack(spacing: 4) {
            HStack {
                Text(input.isEmpty ? "Pounds" : "\(input) lb")
                    .foregroundStyle(labelColor)
                Spacer()
                if let pounds = Double(input), let kg = Shift.kilograms(from: pounds) {
                    Text("\(kg.formatted()) kg").foregroundStyle(highlightColor)
                } else {
                    Text("— kg").foregroundStyle(labelColor)
                }
            }
            .font(.subheadline.weight(.semibold))
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(0.65)

            keypadRow(["7", "8", "9", "delete"])
            keypadRow(["4", "5", "6", "clear"])
            keypadRow(["1", "2", "3", "0", "."])
        }
    }

    private func keypadRow(_ keys: [String]) -> some View {
        HStack(spacing: 4) {
            ForEach(keys, id: \.self) { key in
                Button(intent: EnterWidgetPoundsKey(key)) {
                    Text(key == "delete" ? "⌫" : key == "clear" ? "Clear" : key)
                        .font(.caption.weight(.semibold))
                        .frame(maxWidth: .infinity, minHeight: 28)
                        .background { panel(action, radius: 5) }
                }
                .buttonStyle(.plain)
                .foregroundStyle(highlightColor)
                .accessibilityLabel(key == "delete" ? "Delete last digit" : key == "." ? "Decimal point" : key)
            }
        }
    }

    @ViewBuilder private func panel(_ fill: Color, radius: CGFloat) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius)
        if isAccented {
            shape.strokeBorder(Color.primary.opacity(0.32), lineWidth: 1)
        } else {
            shape.fill(fill)
        }
    }

}

struct SterlingConverterWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SterlingPersonalConverter", provider: ConverterProvider()) {
            SterlingConverterView(entry: $0)
        }
        .configurationDisplayName("Sterling Converter")
        .description("Convert pounds to kilograms from the Home Screen.")
        .supportedFamilies([.systemMedium])
    }
}

@main
struct SterlingShortcuts: WidgetBundle {
    var body: some Widget {
        SterlingCountersWidget()
        SterlingConverterWidget()
    }
}

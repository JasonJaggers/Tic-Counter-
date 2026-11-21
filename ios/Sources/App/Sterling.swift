import EventKit
import SwiftUI
import UIKit
import UniformTypeIdentifiers
import WidgetKit

@main
struct SterlingApp: App {
    var body: some Scene {
        WindowGroup { Workspace().preferredColorScheme(.dark) }
    }
}

enum Palette {
    static let background = Color(red: 12/255, green: 18/255, blue: 28/255)
    static let card = Color(red: 20/255, green: 30/255, blue: 44/255)
    static let action = Color(red: 35/255, green: 59/255, blue: 87/255)
    static let line = Color(red: 38/255, green: 52/255, blue: 72/255)
    static let mint = Color(red: 162/255, green: 228/255, blue: 213/255)
}

struct Workspace: View {
    @Environment(\.scenePhase) private var scene
    @Environment(\.openURL) private var openURL
    @State private var shift = Shift()
    @State private var message: String?
    @State private var reset: String?
    @State private var report = false
    @State private var history = false
    @State private var importing = false
    @State private var pounds = ""
    @State private var kilograms: Int?
    @State private var notes = ""
    @FocusState private var focus: String?
    @State private var textInputs: [String: String] = [:]

    var body: some View {
        ScrollView {
            VStack(spacing: 9) {
                header
                converter
                counterRow(Array(Shift.counts.prefix(3)))
                HStack(spacing: 9) {
                    reading("Total weight", key: "pounds", unit: "lb")
                    reading("AMD concentration", key: "amd", unit: "%")
                }
                counterRow(Array(Shift.counts.suffix(3)))
                actions(levels: false)
                Divider()
                HStack(spacing: 7) {
                    ForEach(Shift.levels, id: \.self) { name in
                        reading(name, key: name, unit: "%")
                    }
                }
                actions(levels: true)
                Agenda()
                Text("Counters stay on this device. Daily dots reset at 6:10 am CT.")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            .frame(maxWidth: 620)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Palette.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom) {
            if focus != nil {
                HStack { Spacer(); Button("Done") { focus = nil }.padding(.horizontal, 16).frame(minHeight: 44) }
                    .background(Palette.card)
            }
        }
        .tint(Palette.mint)
        .onAppear { reload() }
        .onChange(of: scene) { _, value in if value == .active { reload() } }
        .onChange(of: focus) { old, _ in
            if let old, old != "convert" { saveReading(old) }
        }
        .onOpenURL { url in
            guard let scheme = url.scheme, ["sterling", "sterling-personal"].contains(scheme) else { return }
            reload()
            if url.host == "report" { notes = shift.draft; report = true }
            if url.host == "convert" { focus = "convert" }
        }
        .alert("Sterling", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
            Button("OK") { message = nil }
        } message: { Text(message ?? "") }
        .confirmationDialog("A snapshot will be saved first.", isPresented: Binding(
            get: { reset != nil }, set: { if !$0 { reset = nil } }
        ), titleVisibility: .visible) {
            if let reset {
                Button("Reset \(reset)", role: .destructive) { mutate { $0.reset(levels: reset == "tank levels") } }
            }
        }
        .sheet(isPresented: $report) { reportView }
        .sheet(isPresented: $history) {
            NavigationStack {
                List {
                    if shift.archives.isEmpty { Text("No reset snapshots yet.").foregroundStyle(.secondary) }
                    ForEach(shift.archives) { entry in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(entry.originalTimestamp ?? entry.date.formatted()).font(.headline)
                            Text(snapshotText(entry.readings)).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                }
                .navigationTitle("Reset snapshots")
                .toolbar { Button("Done") { history = false } }
            }.preferredColorScheme(.dark)
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let granted = url.startAccessingSecurityScopedResource()
                defer { if granted { url.stopAccessingSecurityScopedResource() } }
                let data = try Data(contentsOf: url)
                let imported = try LegacyBackup.decode(data)
                mutate {
                    guard $0.readings == Readings(), $0.archives.isEmpty, $0.draft.isEmpty,
                          $0.bbsDay == nil, $0.reportDay == nil else { throw ShiftError.existingData }
                    $0 = imported
                }
            } catch { message = error.localizedDescription }
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Image("Brand").resizable().frame(width: 32, height: 32).clipShape(.rect(cornerRadius: 10))
                .accessibilityLabel("Sterling Specialty")
            Text("3.2.7").font(.caption2).foregroundStyle(.secondary)
            Spacer()
            TimelineView(.periodic(from: .now, by: 60)) { context in
                Menu {
                    Link("Maintenance", destination: Links.maintenance)
                    Link("Vector", destination: Links.vector)
                    Button(shift.bbsDay == Shift.workday(context.date) ? "BBS •" : "BBS") {
                        openURL(Links.bbs) { accepted in if accepted { mutate { $0.bbsDay = Shift.workday() } } }
                    }
                    Button(shift.reportDay == Shift.workday(context.date) ? "Report •" : "Report") {
                        notes = shift.draft
                        report = true
                    }
                    Button("Export CSV") { exportCSV() }
                    Button("Reset snapshots") { history = true }
                    Button("Import backup") { importing = true }
                    Button("Export backup") { exportBackup() }
                } label: {
                    Image(systemName: "line.3.horizontal").font(.title2).frame(width: 44, height: 44)
                        .background(Palette.card, in: .rect(cornerRadius: 11))
                        .accessibilityLabel("App menu")
                }
            }
        }
    }

    private var converter: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Text("Mix conversion"); Spacer(); Text("lb → kg") }
                .font(.caption).foregroundStyle(.secondary)
            HStack {
                TextField("Pounds", text: $pounds).keyboardType(.decimalPad).focused($focus, equals: "convert")
                    .padding(9).background(Palette.background, in: .rect(cornerRadius: 9))
                Button("Convert") {
                    do {
                        let input = try Shift.reading(pounds)
                        guard let n = Double(input), let result = Shift.kilograms(from: n) else { throw ShiftError.invalidReading }
                        kilograms = result
                        focus = nil
                    } catch { message = error.localizedDescription }
                }.buttonStyle(.bordered)
            }
            if let kilograms { Text("\(kilograms) kg").font(.title3).foregroundStyle(Palette.mint) }
        }.padding(12).sterlingCard()
    }

    private func counterRow(_ names: [String]) -> some View {
        HStack(spacing: 9) {
            ForEach(names, id: \.self) { name in
                let count = shift.readings.counts[name, default: 0]
                VStack(spacing: 6) {
                    Text(name.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                    Text(count > 0 ? count.formatted() : " ").font(.system(.largeTitle, design: .rounded).weight(.semibold))
                        .monospacedDigit().lineLimit(1).minimumScaleFactor(0.4)
                        .accessibilityLabel("\(name) count \(count)")
                    Button {
                        if mutate({ try $0.add(name) }) {
                            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
                        }
                    } label: {
                        Image(systemName: "plus").font(.title3).frame(maxWidth: .infinity, minHeight: 44)
                            .background(Palette.action, in: .rect(cornerRadius: 9))
                    }.buttonStyle(.plain).accessibilityLabel("Add one to \(name)")
                }.padding(8).frame(maxWidth: .infinity).sterlingCard()
            }
        }
    }

    private func reading(_ label: String, key: String, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            HStack(spacing: 2) {
                TextField("", text: Binding(get: { textInputs[key, default: ""] }, set: { textInputs[key] = $0 }))
                    .keyboardType(.decimalPad).focused($focus, equals: key)
                    .font(.title3.weight(.semibold)).monospacedDigit().frame(minHeight: 44)
                    .accessibilityLabel("\(label), \(unit)")
                Text(unit).font(.caption2).foregroundStyle(.secondary)
            }
        }.padding(.horizontal, 8).padding(.top, 8).frame(maxWidth: .infinity).sterlingCard()
    }

    private func actions(levels: Bool) -> some View {
        HStack(spacing: 8) {
            Button("Share") { share(levels: levels) }.buttonStyle(.bordered).frame(minHeight: 44)
                .accessibilityLabel(levels ? "Share tank levels" : "Share counts and hold readings")
            Spacer()
            Button {
                commitFocused()
                mutate { if levels { $0.undoLevels() } else { $0.undoCount() } }
            } label: {
                Image(systemName: "arrow.uturn.backward").frame(width: 44, height: 44)
            }.accessibilityLabel(levels ? "Undo last tank level change" : "Undo last count")
            .disabled(levels ? shift.levelUndo == nil : shift.countUndo.isEmpty)
            Button {
                if commitFocused() { reset = levels ? "tank levels" : "counts and hold readings" }
            } label: {
                Image(systemName: "xmark").frame(width: 44, height: 44).foregroundStyle(.pink)
            }.accessibilityLabel(levels ? "Reset tank levels" : "Reset counts")
        }
    }

    private var reportView: some View {
        NavigationStack {
            VStack(spacing: 12) {
                TextEditor(text: $notes).accessibilityLabel("Shift report notes")
                    .scrollContentBackground(.hidden).padding(8).sterlingCard()
                Button("Open in ChatGPT") {
                    let value = notes.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !value.isEmpty else { return }
                    var components = URLComponents(string: "https://chatgpt.com/")!
                    components.queryItems = [URLQueryItem(name: "q", value: "Sterling report\n\n" + value)]
                    guard let url = components.url, url.absoluteString.utf8.count <= 14_000 else {
                        message = "Shorten the report before opening ChatGPT."
                        report = false
                        return
                    }
                    openURL(url) { accepted in
                        if accepted {
                            mutate { $0.reportDay = Shift.workday() }
                            report = false
                        }
                    }
                }.buttonStyle(.borderedProminent).disabled(notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }.padding().background(Palette.background)
            .navigationTitle("Sterling report")
            .toolbar { Button("Done") { report = false } }
            .onChange(of: notes) { _, value in mutate(refresh: false) { $0.draft = value } }
        }.preferredColorScheme(.dark)
    }

    @discardableResult private func commitFocused() -> Bool {
        guard let key = focus else { return true }
        let saved = key == "convert" || saveReading(key)
        if saved { focus = nil }
        return saved
    }

    private func share(levels: Bool) {
        guard commitFocused() else { return }
        let value = shift.share(levels: levels)
        guard !value.isEmpty else { message = "Nothing recorded to share."; return }
        presentShare(value)
    }

    private func exportCSV() {
        guard commitFocused() else { return }
        do {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("sterling-counts-\(Shift.workday()).csv")
            try shift.csv().write(to: url, atomically: true, encoding: .utf8)
            presentShare(url)
        } catch { message = error.localizedDescription }
    }

    private func exportBackup() {
        guard commitFocused() else { return }
        do {
            let latest = try ShiftStore.shared().read()
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("sterling-backup-\(Shift.workday()).json")
            try JSONEncoder().encode(NativeBackup(shift: latest)).write(to: url, options: .atomic)
            presentShare(url)
        } catch { message = error.localizedDescription }
    }

    private func presentShare(_ item: Any) {
        guard let window = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive })?.keyWindow,
              var presenter = window.rootViewController else { return }
        while let next = presenter.presentedViewController { presenter = next }
        let controller = UIActivityViewController(activityItems: [item], applicationActivities: nil)
        controller.popoverPresentationController?.sourceView = presenter.view
        controller.popoverPresentationController?.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
        presenter.present(controller, animated: true)
    }

    private func snapshotText(_ readings: Readings) -> String {
        var saved = Shift()
        saved.readings = readings
        let text = [saved.share(levels: false), saved.share(levels: true)].filter { !$0.isEmpty }.joined(separator: "\n")
        return text.isEmpty ? "No nonzero readings." : text
    }

    @discardableResult private func saveReading(_ key: String) -> Bool {
        let value = textInputs[key, default: ""]
        if key == "pounds", value == shift.readings.pounds { return true }
        if key == "amd", value == shift.readings.amd { return true }
        if Shift.levels.contains(key), value == shift.readings.levels[key, default: ""] { return true }
        return mutate {
            switch key {
            case "pounds": $0.readings.pounds = try Shift.reading(value)
            case "amd": $0.readings.amd = try Shift.reading(value, maximum: 100)
            default: try $0.setLevel(key, value)
            }
        }
    }

    private func reload() {
        do {
            shift = try ShiftStore.shared().read()
            refreshInputs()
            WidgetCenter.shared.reloadAllTimelines()
        } catch { message = error.localizedDescription }
    }

    private func refreshInputs() {
        var fresh = shift.readings.levels
        fresh["pounds"] = shift.readings.pounds
        fresh["amd"] = shift.readings.amd
        if let focus, let edited = textInputs[focus] { fresh[focus] = edited }
        textInputs = fresh
    }

    @discardableResult private func mutate(refresh: Bool = true, _ edit: (inout Shift) throws -> Void) -> Bool {
        do {
            shift = try ShiftStore.shared().update(edit)
            if refresh {
                refreshInputs()
                WidgetCenter.shared.reloadAllTimelines()
            }
            return true
        } catch {
            message = error.localizedDescription
            return false
        }
    }
}

extension View {
    func sterlingCard() -> some View {
        background(Palette.card, in: .rect(cornerRadius: 12))
            .overlay { RoundedRectangle(cornerRadius: 12).strokeBorder(Palette.line).allowsHitTesting(false) }
    }
}

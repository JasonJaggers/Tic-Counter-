import EventKit
import SwiftUI

struct Agenda: View {
    @State private var store = EKEventStore()
    @State private var events: [EKEvent] = []
    @State private var calendars: [EKCalendar] = []
    @AppStorage("sterling.workCalendarIdentifier") private var workCalendarID = ""
    @State private var calendarStatus = EKEventStore.authorizationStatus(for: .event)
    @State private var error: String?
    @Environment(\.scenePhase) private var phase

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Link("Google Calendar ↗", destination: Links.calendar)
                Spacer()
                Link("Open ADP ↗", destination: Links.adp)
            }.font(.footnote).frame(minHeight: 44)
            Text("Calendar").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            if calendarStatus == .fullAccess {
                Picker("Work calendar", selection: $workCalendarID) {
                    Text("Choose a calendar").tag("")
                    if !workCalendarID.isEmpty && !calendars.contains(where: { $0.calendarIdentifier == workCalendarID }) {
                        Text("Previously selected calendar is unavailable").tag(workCalendarID)
                    }
                    ForEach(calendars, id: \.calendarIdentifier) { calendar in
                        Text("\(calendar.title) · \(calendar.source.title)").tag(calendar.calendarIdentifier)
                    }
                }
                .pickerStyle(.menu)
                .font(.footnote)
                if workCalendarID.isEmpty {
                    Text("Choose your work calendar to show its agenda.").font(.caption)
                } else if !calendars.contains(where: { $0.calendarIdentifier == workCalendarID }) {
                    Text("Sync your work calendar to this iPhone or select it again.").font(.caption)
                } else if events.isEmpty {
                    Text("No work events in the next seven days.").font(.caption)
                }
                ForEach(Array(events.enumerated()), id: \.offset) { entry in
                    let event = entry.element
                    VStack(alignment: .leading, spacing: 2) {
                        Text(event.title ?? "Untitled event").font(.subheadline)
                        Text(event.startDate.formatted(date: .abbreviated, time: event.isAllDay ? .omitted : .shortened))
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 3)
                }
            } else if calendarStatus == .notDetermined || calendarStatus == .writeOnly {
                Button("Choose work calendar") {
                    Task {
                        do { _ = try await store.requestFullAccessToEvents(); refresh() }
                        catch { self.error = error.localizedDescription }
                    }
                }.font(.footnote)
            } else {
                Text("Allow calendar access in Settings to show your agenda.").font(.caption)
            }
            if let error { Text(error).font(.caption).foregroundStyle(.secondary) }
        }
        .padding(12).sterlingCard()
        .onAppear(perform: refresh)
        .onChange(of: workCalendarID) { _, _ in refresh() }
        .onChange(of: phase) { _, value in if value == .active { refresh() } }
        .onReceive(NotificationCenter.default.publisher(for: .EKEventStoreChanged)) { _ in refresh() }
    }

    private func refresh() {
        calendarStatus = EKEventStore.authorizationStatus(for: .event)
        events = []
        guard calendarStatus == .fullAccess else { calendars = []; return }
        calendars = store.calendars(for: .event).sorted { lhs, rhs in
            let left = lhs.title + " " + lhs.source.title
            let right = rhs.title + " " + rhs.source.title
            return left.localizedStandardCompare(right) == .orderedAscending
        }
        guard !workCalendarID.isEmpty,
              let calendar = calendars.first(where: { $0.calendarIdentifier == workCalendarID }) else { return }
        let now = Date()
        let end = Calendar.current.date(byAdding: .day, value: 7, to: now) ?? now
        let predicate = store.predicateForEvents(withStart: now, end: end, calendars: [calendar])
        events = Array(store.events(matching: predicate).sorted { $0.startDate < $1.startDate }.prefix(8))
    }
}

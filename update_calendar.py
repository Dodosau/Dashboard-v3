import requests
from icalendar import Calendar
from datetime import datetime, date
import pytz
import json
import os

ICAL_URL = "https://p149-caldav.icloud.com/published/2/MjAxMzUxNTc3NTkyMDEzNcr33mN1DGhEldXvug77KN0t9d1rebBleay0FCAjfVQLuIMQEM2Z-MHl8yNkiiJKBWwm3k4FQkJ6pFVfQRdCTIk"
TZ = pytz.timezone("America/Toronto")

def get_events_today():
    resp = requests.get(ICAL_URL)
    resp.raise_for_status()
    cal = Calendar.from_ical(resp.text)

    today = datetime.now(TZ).date()
    events = []

    for component in cal.walk():
        if component.name == "VEVENT":
            dtstart = component.get("dtstart").dt
            summary = str(component.get("summary"))

            if isinstance(dtstart, datetime):
                dtstart = dtstart.astimezone(TZ)
                start_date = dtstart.date()
                start_time = dtstart.strftime("%H:%M")
            else:
                start_date = dtstart
                start_time = "Toute la journée"

            if start_date == today:
                events.append({
                    "time": start_time,
                    "summary": summary
                })

    events.sort(key=lambda e: e["time"])
    return events

if __name__ == "__main__":
    events = get_events_today()

    output_path = "widgets/calendar/events.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=2)

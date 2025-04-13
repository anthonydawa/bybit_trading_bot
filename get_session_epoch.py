import json
from datetime import datetime, timedelta
import pytz

def get_trading_session_epochs(file_path='sessions.json',current_date=None):
    # PHT (Philippine Time) timezone
    PHT = pytz.timezone('Asia/Manila')

    # Helper function to convert a datetime object to epoch in milliseconds
    def to_epoch(dt):
        return int(dt.timestamp() * 1000)  # Convert to milliseconds

    # If no date is provided, use today's date in PHT
    if current_date is None:
        current_date = datetime.now(pytz.timezone('Asia/Manila')).strftime('%Y-%m-%d')

    # Get the current date in PHT
    current_date_pht = PHT.localize(datetime.strptime(current_date, '%Y-%m-%d'))

    # Session times (in PHT timezone)
    sessions = {
        "sydney": {"start": "05:00", "end": "14:00"},
        "tokyo": {"start": "08:00", "end": "17:00"},
        "london": {"start": "15:00", "end": "00:00"},  # The end time is the next day
        "ny": {"start": "21:00", "end": "06:00"}       # The end time is the next day
    }

    session_epochs = {}

    # Calculate the epoch times for each session
    for session, times in sessions.items():
        start_time = f"{current_date} {times['start']}"
        end_time = f"{current_date} {times['end']}"

        start_dt = PHT.localize(datetime.strptime(start_time, '%Y-%m-%d %H:%M'))
        end_dt = PHT.localize(datetime.strptime(end_time, '%Y-%m-%d %H:%M'))

        # If the end time is on the next day, adjust it
        if "00:00" in times["end"] or "06:00" in times["end"]:
            end_dt = end_dt + timedelta(days=1)

        # Store the start and end epoch times
        session_epochs[session] = {
            "start_epoch": to_epoch(start_dt),
            "end_epoch": to_epoch(end_dt)
        }

    # Save to a JSON file (replace the file every time)
    with open(file_path, 'w') as json_file:
        json.dump(session_epochs, json_file, indent=4)

    return session_epochs


def get_yesterday_trading_session_epochs(file_path='sessions_yesterday.json'):
    yesterday = (datetime.now(pytz.timezone('Asia/Manila')) - timedelta(days=1)).strftime('%Y-%m-%d')
    session_epochs = get_trading_session_epochs(file_path=file_path,current_date=yesterday)
    
    with open('sessions_yesterday.json', 'w') as json_file:
        json.dump(session_epochs, json_file, indent=4)
    
    return session_epochs

# Example usage:
if __name__ == "__main__":
    # Get session epoch times for today (default)
    # session_epochs_today = get_trading_session_epochs()

    # print("Today's Trading Sessions (in Epoch Time):")
    # for session, times in session_epochs_today.items():
    #     print(f"{session.capitalize()} session:")
    #     print(f"  Start Epoch: {times['start_epoch']}")
    #     print(f"  End Epoch: {times['end_epoch']}")
    #     print()

    # Example usage with a specific date ymd
    # specific_date = "2025-01-25"  # You can specify any date here
    # session_epochs_specific_date = get_trading_session_epochs(specific_date)

    # print(f"Trading Sessions for {specific_date} (in Epoch Time):")
    # for session, times in session_epochs_specific_date.items():
    #     print(f"{session.capitalize()} session:")
    #     print(f"  Start Epoch: {times['start_epoch']}")
    #     print(f"  End Epoch: {times['end_epoch']}")
    #     print()

    # specific_date = "2025-01-25"  # You can specify any date here
    # session_epochs_specific_date = get_trading_session_epochs(specific_date)

    # print(f"Trading Sessions for {specific_date} (in Epoch Time):")
    # for session, times in session_epochs_specific_date.items():
    #     print(f"{session.capitalize()} session:")
    #     print(f"  Start Epoch: {times['start_epoch']}")
    #     print(f"  End Epoch: {times['end_epoch']}")
    #     print()
    
    # Get session epochs for yesterday
    get_yesterday_trading_session_epochs()
    get_trading_session_epochs()
    # print("Yesterday's Trading Sessions (in Epoch Time):")
    # for session, times in session_epochs_yesterday.items():
    #     print(f"{session.capitalize()} session:")
    #     print(f"  Start Epoch: {times['start_epoch']}")
    #     print(f"  End Epoch: {times['end_epoch']}")
    #     print()

import json
from datetime import datetime, timedelta

SYDNEY_START = 5
SYDNEY_END = 14  # 2:00 PM
TOKYO_START = 7
TOKYO_END = 16
LONDON_START = 15
LONDON_END = 24
NY_START = 21
NY_END = 6

RSI_PERIOD = 14  # Period for RSI calculation

def determine_session(hour):
    """
    Determine which sessions are active based on the current hour.

    :param hour: int - The current hour in 24-hour format (PHT).
    :return: list - A list of active sessions.
    """
    active_sessions = []

    # Sydney session: starts at 5 AM and ends at 2 PM (PHT)
    if SYDNEY_START <= hour < SYDNEY_END:
        active_sessions.append("Sydney")

    # Tokyo session: starts at 7 AM and ends at 4 PM (PHT)
    if TOKYO_START <= hour < TOKYO_END:
        active_sessions.append("Tokyo")

    # London session: starts at 3 PM and ends at midnight (PHT)
    if LONDON_START <= hour < LONDON_END:
        active_sessions.append("London")

    # New York session: starts at 9 PM and ends at 6 AM (PHT)
    if NY_START <= hour < NY_END or (NY_START <= hour + 24 < 6):
        active_sessions.append("New York")

    return active_sessions


class VWAPRSITracker:
    """
    Tracks VWAP and RSI calculations for multiple sessions.
    """

    def __init__(self):
        self.session_data = {
            "Tokyo": {"cumulative_pv": 0, "cumulative_vol": 0, "close_prices": []},
            "London": {"cumulative_pv": 0, "cumulative_vol": 0, "close_prices": []},
            "New York": {"cumulative_pv": 0, "cumulative_vol": 0, "close_prices": []},
            "Sydney": {"cumulative_pv": 0, "cumulative_vol": 0, "close_prices": []},
        }

    def reset_session(self, session):
        """
        Resets VWAP and RSI data for a session.

        :param session: str - The session to reset.
        """
        self.session_data[session] = {"cumulative_pv": 0, "cumulative_vol": 0, "close_prices": []}

    def update_vwap(self, session, high, low, close, volume):
        """
        Updates VWAP for a specific session.

        :param session: str - The session name.
        :param high: float - High price of the candle.
        :param low: float - Low price of the candle.
        :param close: float - Close price of the candle.
        :param volume: float - Volume of the candle.
        """
        typical_price = (high + low + close) / 3
        self.session_data[session]["cumulative_pv"] += typical_price * volume
        self.session_data[session]["cumulative_vol"] += volume
        self.session_data[session]["close_prices"].append(close)

    def get_vwap(self, session):
        """
        Calculates VWAP for a specific session.

        :param session: str - The session name.
        :return: float - The VWAP value.
        """
        data = self.session_data[session]
        if data["cumulative_vol"] > 0:
            return data["cumulative_pv"] / data["cumulative_vol"]
        return 0.0  # Ensure it always returns a float (0.0) instead of None

    def calculate_rsi(self, session):
        """
        Calculates the RSI for a specific session using the last 'RSI_PERIOD' close prices.

        :param session: str - The session name.
        :return: float - The RSI value, or None if insufficient data.
        """
        close_prices = self.session_data[session]["close_prices"]
        if len(close_prices) < RSI_PERIOD:
            return None  # Not enough data to calculate RSI

        # Calculate the gains and losses
        gains = []
        losses = []
        for i in range(1, RSI_PERIOD + 1):
            change = close_prices[-i] - close_prices[-(i + 1)]
            if change > 0:
                gains.append(change)
                losses.append(0)
            else:
                gains.append(0)
                losses.append(abs(change))

        # Calculate average gain and average loss
        avg_gain = sum(gains) / RSI_PERIOD
        avg_loss = sum(losses) / RSI_PERIOD

        # Calculate the RSI
        if avg_loss == 0:
            return 100  # Avoid division by zero, perfect momentum
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))

        return rsi


def backtest_sessions_with_vwap_rsi(data_file):
    """
    Loops through historical data, determines active trading sessions, and calculates VWAP and RSI.

    :param data_file: str - The file containing historical kline data.
    :return: None
    """
    try:
        # Load the historical data
        with open(data_file, "r") as f:
            historical_data = json.load(f)

        # Initialize VWAP and RSI Tracker
        vwap_rsi_tracker = VWAPRSITracker()
        last_active_sessions = set()

        # Process each kline entry
        for entry in historical_data:
            # Parse kline data
            timestamp_ms = int(entry[0])  # Start time in milliseconds
            high = float(entry[2])  # High price
            low = float(entry[3])  # Low price
            close = float(entry[4])  # Close price
            volume = float(entry[5])  # Volume

            # Convert timestamp to PHT
            timestamp = datetime.utcfromtimestamp(timestamp_ms / 1000) + timedelta(hours=8)

            # Determine active sessions
            current_active_sessions = set(determine_session(timestamp.hour))

            # Remove VWAP and RSI tracking for sessions that ended
            for session in last_active_sessions - current_active_sessions:
                vwap_rsi_tracker.reset_session(session)

            # Reset VWAP and RSI for newly started sessions
            for session in current_active_sessions - last_active_sessions:
                vwap_rsi_tracker.reset_session(session)

            # Update VWAP and RSI for active sessions
            for session in current_active_sessions:
                vwap_rsi_tracker.update_vwap(session, high, low, close, volume)

            # Get VWAP and RSI values and display them
            vwap_values = [f"VWAP {session}: {vwap_rsi_tracker.get_vwap(session):.2f}" for session in current_active_sessions]
            rsi_values = [
                f"RSI {session}: {vwap_rsi_tracker.calculate_rsi(session) if vwap_rsi_tracker.calculate_rsi(session) is not None else 'N/A'}"
                for session in current_active_sessions]
            print(f"{timestamp} PHT: Active Session(s): {', '.join(vwap_values + rsi_values)}")

            # Update last active sessions
            last_active_sessions = current_active_sessions

    except Exception as e:
        print(f"Error in backtesting with VWAP and RSI: {str(e)}")


# Example usage
if __name__ == "__main__":
    # Replace 'BTCUSDT_5m.json' with your actual historical data file name
    backtest_sessions_with_vwap_rsi("backtest/historical_klines/BTCUSDT_5m_historical_data.json")

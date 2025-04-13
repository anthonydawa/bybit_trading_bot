import json
from datetime import datetime, timedelta
from collections import deque

SYDNEY_START = 5
SYDNEY_END = 14  # 2:00 PM
TOKYO_START = 7
TOKYO_END = 16
LONDON_START = 15
LONDON_END = 24
NY_START = 21
NY_END = 6

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


class VWAPTracker:
    """
    Tracks VWAP calculations and RSI calculations.
    """
    def __init__(self, rsi_period=14):
        # Only need one deque for candles
        self.candles = deque()  # Holds recent candles for RSI calculation
        self.rsi_period = rsi_period
        self.session_data = {
            "Tokyo": {"cumulative_pv": 0, "cumulative_vol": 0},
            "London": {"cumulative_pv": 0, "cumulative_vol": 0},
            "New York": {"cumulative_pv": 0, "cumulative_vol": 0},
            "Sydney": {"cumulative_pv": 0, "cumulative_vol": 0},
        }

    def reset_session(self, session):
        """
        Resets VWAP data for a session.

        :param session: str - The session to reset.
        """
        self.session_data[session] = {"cumulative_pv": 0, "cumulative_vol": 0}

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

    def get_vwap(self, session):
        """
        Calculates VWAP for a specific session.

        :param session: str - The session name.
        :return: float - The VWAP value.
        """
        data = self.session_data[session]
        if data["cumulative_vol"] > 0:
            return data["cumulative_pv"] / data["cumulative_vol"]
        return 0

    def add_candle(self, high, low, close, volume):
        """
        Adds a candle to the data for VWAP and RSI calculation.

        :param high: float - High price of the candle.
        :param low: float - Low price of the candle.
        :param close: float - Close price of the candle.
        :param volume: float - Volume of the candle.
        """
        # Add the new candle to the deque
        self.candles.append({"high": high, "low": low, "close": close, "volume": volume})

        # Remove the oldest candle if the deque size exceeds the RSI period
        if len(self.candles) > self.rsi_period:
            self.candles.popleft()

        # Update VWAP (session doesn't affect RSI)
        for session in self.session_data:
            self.update_vwap(session, high, low, close, volume)

    def get_rsi(self):
        """
        Calculates the RSI using the recent candles (not session-dependent).
        
        :return: float - The RSI value for the most recent period.
        """
        if len(self.candles) < self.rsi_period:
            return None  # Not enough data for RSI

        try:
            # Extract closing prices from the candles (assuming 'close' is the 4th index)
            closing_prices = [float(candle["close"]) for candle in self.candles]

            # Calculate price changes
            price_changes = [closing_prices[i] - closing_prices[i-1] for i in range(1, len(closing_prices))]

            # Calculate gains and losses
            gains = [change if change > 0 else 0 for change in price_changes]
            losses = [-change if change < 0 else 0 for change in price_changes]

            # Initial average gain and loss
            avg_gain = sum(gains[:self.rsi_period]) / self.rsi_period
            avg_loss = sum(losses[:self.rsi_period]) / self.rsi_period

            # Update average gain and loss for each period after the initial one
            for i in range(self.rsi_period, len(gains)):
                avg_gain = (avg_gain * (self.rsi_period - 1) + gains[i]) / self.rsi_period
                avg_loss = (avg_loss * (self.rsi_period - 1) + losses[i]) / self.rsi_period

            # Calculate the RSI for the most recent period
            if avg_loss == 0:
                rsi = 100  # Avoid division by zero if there are no losses
            else:
                rs = avg_gain / avg_loss
                rsi = 100 - (100 / (1 + rs))

            return rsi
        except Exception as e:
            return {"error": str(e)}



def backtest_sessions_with_vwap_and_rsi(data_file):
    """
    Loops through historical data, determines active trading sessions, and calculates VWAP and RSI.

    :param data_file: str - The file containing historical kline data.
    :return: None
    """
    try:
        # Load the historical data
        with open(data_file, "r") as f:
            historical_data = json.load(f)

        # Initialize VWAP Tracker
        vwap_tracker = VWAPTracker()
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

            # Remove VWAP tracking for sessions that ended
            for session in last_active_sessions - current_active_sessions:
                vwap_tracker.reset_session(session)

            # Reset VWAP for newly started sessions
            for session in current_active_sessions - last_active_sessions:
                vwap_tracker.reset_session(session)

            # Add new candle data and update VWAP
            vwap_tracker.add_candle(high, low, close, volume)
            print(high, low, close, volume)
            print(vwap_tracker.candles)
            # Get VWAP and RSI values and display them
            vwap_rsi_values = [
                f"VWAP {session}: {vwap_tracker.get_vwap(session):.2f}, RSI: {vwap_tracker.get_rsi() if vwap_tracker.get_rsi() is not None else 'N/A'}"
                for session in current_active_sessions
            ]

            print(f"{timestamp} PHT: Active Session(s): {', '.join(vwap_rsi_values)}")

            # Update last active sessions
            last_active_sessions = current_active_sessions

    except Exception as e:
        print(f"Error in backtesting with VWAP and RSI: {str(e)}")


# Example usage
if __name__ == "__main__":
    # Replace 'BTCUSDT_5m.json' with your actual historical data file name
    backtest_sessions_with_vwap_and_rsi("backtest\\historical_klines\\BTCUSDT_5m_historical_data.json")


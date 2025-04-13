import pandas as pd

from kline_utils import get_kline_data

def get_trend(symbol, interval="240", category="linear"):
    """
    Determines the long-term trend based on the 21 and 50 EMA cross.
    
    :param symbol: str - The trading pair symbol, e.g., "BTCUSDT".
    :param interval: str - The time interval for the kline data, default is "240" (4-hour).
    :param category: str - The trading category, default is "linear".
    :return: str - "long" for bullish trend, "short" for bearish trend.
    """
    try:
        # Fetch kline data
        klines = get_kline_data(symbol=symbol, interval=interval, category=category)
        if "error" in klines:
            return klines["error"]

        # Convert kline data to a DataFrame
        df = pd.DataFrame(klines, columns=["startTime", "openPrice", "highPrice", "lowPrice", "closePrice", "volume", "turnover"])
        
        # Convert closePrice to float
        df["closePrice"] = df["closePrice"].astype(float)

        # Calculate EMAs
        df["EMA_9"] = df["closePrice"].ewm(span=9, adjust=False).mean()
        df["EMA_21"] = df["closePrice"].ewm(span=21, adjust=False).mean()

        # Check the most recent EMA cross
        if df["EMA_9"].iloc[-1] > df["EMA_21"].iloc[-1]:
            return "long"  # Bullish trend
        else:
            return "short"  # Bearish trend
    except Exception as e:
        return f"Error: {str(e)}"

# Example usage
if __name__ == "__main__":
    trend = get_trend(symbol="BTCUSDT")
    print(f"The current trend is: {trend}")

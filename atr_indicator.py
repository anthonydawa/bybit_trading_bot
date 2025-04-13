from pybit.unified_trading import HTTP

from calculate_mean import calculate_mean_close

# Initialize session
session = HTTP()

def get_kline_data(symbol, interval, category="linear", start=None, end=None):
    """
    Fetches kline (candlestick) data for a given symbol and interval, reversing the order to most recent first.

    :param symbol: str - The trading pair symbol, e.g., "BTCUSDT".
    :param interval: int - The time interval for the kline data, e.g., 5 (minutes).
    :param category: str - The trading category, default is "linear".
    :param start: int or None - Start timestamp in milliseconds. Default is None.
    :param end: int or None - End timestamp in milliseconds. Default is None.
    :return: list - The kline data reversed and excluding the first entry.
    """
    try:
        # Prepare the request parameters
        params = {
            "category": category,
            "symbol": symbol,
            "interval": interval,
            "limit": 300
        }
        # Include start and end if provided
        if start:
            params["start"] = start
        if end:
            params["end"] = end
        
        # Make the API call
        response = session.get_kline(**params)
        
        # Reverse the kline data and exclude the first entry
        return list(reversed(response['result']['list'][1:]))
    except Exception as e:
        return {"error": str(e)}

def calculate_atr(klines, period=14):
    """
    Computes the Average True Range (ATR) for given kline data.
    
    :param klines: list - Kline data fetched from get_kline_data function.
    :param period: int - The number of periods for the ATR calculation. Default is 14.
    :return: float - The calculated ATR value.
    """
    # Extract high, low, and close prices using correct indices
    high_prices = [float(kline[2]) for kline in klines]
    low_prices = [float(kline[3]) for kline in klines]
    close_prices = [float(kline[4]) for kline in klines]

    true_ranges = []

    for i in range(1, len(klines)):
        high_low = high_prices[i] - low_prices[i]
        high_prev_close = abs(high_prices[i] - close_prices[i - 1])
        low_prev_close = abs(low_prices[i] - close_prices[i - 1])
        
        # True range is the maximum of these three values
        tr = max(high_low, high_prev_close, low_prev_close)
        true_ranges.append(tr)

    # Ensure enough data for calculation
    if len(true_ranges) < period:
        raise ValueError("Not enough data to calculate ATR for the given period.")

    # Compute the ATR as the average of the true ranges over the given period
    atr = sum(true_ranges[-period:]) / period
    return atr

# Example usage
if __name__ == "__main__":
    # Fetch kline data separately
    symbol = "SLPUSDT"
    klines = get_kline_data(symbol=symbol, interval=5)
    kline_session_data = get_kline_data(symbol=symbol, interval=5, start=1738454400000, end=1738486800000)
    mean_close = calculate_mean_close(kline_session_data)
    atr_value = calculate_atr(klines)

    print("mean")
    print(mean_close)
    print("atr")
    print(atr_value)
    print("total:",  mean_close - atr_value)






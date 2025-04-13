from pybit.unified_trading import HTTP


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

def get_highest_high_lowest_low(markets, start, end):
    """
    Fetches the highest high and lowest low for a range of markets within a given time range.
    
    :param markets: list - List of market symbols (e.g., ["BTCUSDT", "ETHUSDT"]).
    :param start: int - Start timestamp in milliseconds.
    :param end: int - End timestamp in milliseconds.
    :return: dict - Dictionary with market names and their highest high and lowest low.
    """
    results = {}
    
    for market in markets:
        try:
            # Fetch kline data for each market
            klines = get_kline_data(market, interval=5, start=start, end=end)
            if "error" in klines:
                results[market] = {"error": klines["error"]}
                continue

            # Extract high and low values
            highs = [kline[2] for kline in klines]  # Assuming high is at index 3
            lows = [kline[3] for kline in klines]   # Assuming low is at index 4

            # Store results
            results[market] = {
                "highest_high": max(highs),
                "lowest_low": min(lows)
            }
        
        except Exception as e:
            results[market] = {"error": str(e)}
    
    return results

def get_extreme_value(market, start, end, position_type):
    """
    Returns the highest high for "short" or lowest low for "long" for a single market.
    
    :param market: str - Market symbol (e.g., "BTCUSDT").
    :param start: int - Start timestamp in milliseconds.
    :param end: int - End timestamp in milliseconds.
    :param position_type: str - "short" for highest high, "long" for lowest low.
    :return: float - The highest high or lowest low based on position_type.
    """
    # Fetch market data for the single market
    market_data = get_highest_high_lowest_low([market], start, end)

    # Extract the required value based on position_type
    if market not in market_data or "error" in market_data[market]:
        raise ValueError(f"Error retrieving data for market {market}: {market_data[market].get('error')}")
    
    data = market_data[market]
    if position_type == "short":
        extreme_value = data["highest_high"]
    elif position_type == "long":
        extreme_value = data["lowest_low"]
    else:
        raise ValueError("Invalid position_type. Use 'short' or 'long'.")

    # Ensure the return value is a numeric type (float or int)
    try:
        return float(extreme_value)  # Ensure it's a number
    except ValueError:
        raise ValueError(f"Invalid value for extreme_value: {extreme_value}. Expected a number.")


# Example usage
if __name__ == "__main__":
    market = "MKRUSDT"  # Example market
    start_epoch = 1736456400000  # Example start timestamp
    end_epoch = 1736488800000    # Example end timestamp
    # Get highest high for "short"
    highest_high = get_extreme_value(market, start_epoch, end_epoch, "short")
    print("Highest High (Short):", highest_high)

    # Get lowest low for "long"
    lowest_low = get_extreme_value(market, start_epoch, end_epoch, "long")
    print("Lowest Low (Long):", lowest_low)

    get_extreme_value("SOLUSDT",1738454400000,1738454400000,"long")

    
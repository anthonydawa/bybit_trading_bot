from pybit.unified_trading import HTTP

from backtest.backtestv1_functions import get_bollinger_bands

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
    




# Example usage
if __name__ == "__main__":
    results = get_kline_data(symbol="LUCEUSDT", interval=5,start=1,end=5)
    print(get_bollinger_bands(results, 20, 2.0))

    

# Response Parameters
# Parameter	Type	Comments
# category	string	Product type
# symbol	string	Symbol name
# list	array	
# An string array of individual candle
# Sort in reverse by startTime
# > list[0]: startTime	string	Start time of the candle (ms)
# > list[1]: openPrice	string	Open price
# > list[2]: highPrice	string	Highest price
# > list[3]: lowPrice	string	Lowest price
# > list[4]: closePrice	string	Close price. Is the last traded price when the candle is not closed
# > list[5]: volume	string	Trade volume
# USDT or USDC contract: unit is base coin (e.g., BTC)
# Inverse contract: unit is quote coin (e.g., USD)
# > list[6]: turnover	string	Turnover.
# USDT or USDC contract: unit is quote coin (e.g., USDT)
# Inverse contract: unit is base coin (e.g., BTC)
import json
from pybit.unified_trading import HTTP
from kline_utils import get_kline_data
import numpy as np

session = HTTP(
    testnet=False,
    api_key="JAw1PgQ9yd2mN2kYtF",
    api_secret="KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM",
)

# Fetch all positions with pagination
def fetch_all_positions():
    positions = []
    next_page_cursor = None

    while True:
        response = session.get_positions(
            category="linear", 
            settleCoin="USDT", 
            cursor=next_page_cursor  # Provide cursor for the next page
        )

        if response.get("retCode") != 0:
            print("Error fetching data:", response.get("retMsg"))
            break

        # Append fetched positions to the list
        positions.extend(response.get("result", {}).get("list", []))

        # Check if there is a next page
        next_page_cursor = response.get("result", {}).get("nextPageCursor")
        if not next_page_cursor:
            break  # Exit loop if no more pages

    return positions

def get_market_trendline_slope(kline_data):
    """
    Calculate the normalized trendline slope using linear regression.
    
    Args:
        kline_data (list): List of kline data where each entry is [timestamp, open, high, low, close, volume].
    
    Returns:
        float: Normalized slope between -1 and 1.
    """
    try:
        closing_prices = np.array([float(entry[4]) for entry in kline_data])
        timestamps = np.arange(len(closing_prices))  # Use relative indices for timestamps

        # Linear regression for trendline slope
        A = np.vstack([timestamps, np.ones_like(timestamps)]).T
        slope, intercept = np.linalg.lstsq(A, closing_prices, rcond=None)[0]

        # Normalize slope to be between -1 and 1 using the range of closing prices
        max_price_range = np.ptp(closing_prices)  # Peak to peak (max - min) of prices
        normalized_slope = slope / max_price_range if max_price_range != 0 else 0

        return max(-1, min(1, normalized_slope))  # Clamp to range [-1, 1]
    except Exception as e:
        return {"error": str(e)}

def fetch_market_trends(start,end):
    """
    Fetch all positions and calculate the trendline slope for each market.
    
    Returns:
        list: A list of dictionaries, each containing the market symbol and its trendline slope.
    """
    positions = fetch_all_positions()  # Get all open positions
    market_trends = []  # List to hold market trends

    for position in positions:
        symbol = position.get("symbol")
        if not symbol:
            continue  # Skip positions without a symbol

        # Fetch kline data for the symbol
        try:
            kline_data = get_kline_data(
                symbol, 
                5,  # Timeframe in minutes
                start=start,  # Use your session start time
                end=end  # Use your session end time
            )

            # Calculate the trendline slope
            trendline_slope = get_market_trendline_slope(kline_data)
            # Ensure the trendline slope is a plain Python float
            trendline_slope = float(trendline_slope)

            market_trends.append({"market": symbol, "trendline_slope": trendline_slope})
        except Exception as e:
            market_trends.append({"market": symbol, "error": str(e)})

    return market_trends

def filter_market_trends(trends, direction):
    """
    Filter markets based on the trendline slope direction.

    Args:
        trends (list): List of dictionaries with market and trendline slope.
        direction (str): "short" to filter positive slopes, "long" for negative slopes.

    Returns:
        list: A list of markets matching the specified direction.
    """
    if direction not in {"short", "long"}:
        raise ValueError("Invalid direction. Must be 'short' or 'long'.")

    filtered_markets = []
    for trend in trends:
        if "trendline_slope" in trend and isinstance(trend["trendline_slope"], float):
            if direction == "short" and trend["trendline_slope"] > 0:
                filtered_markets.append(trend["market"])
            elif direction == "long" and trend["trendline_slope"] < 0:
                filtered_markets.append(trend["market"])

    return filtered_markets




# open_market_positions = fetch_all_positions()

# sample data of fetch_all_positions 
# [{'symbol': 'ORDERUSDT', 'leverage': '10', 'autoAddMargin': 0, 'avgPrice': '0.23450657', 'liqPrice': '1.16297139', 'riskLimitValue': '25000', 'takeProfit': '', 'positionValue': '49.9499', 'isReduceOnly': False, 'tpslMode': 'Full', 'riskId': 1, 'trailingStop': '0', 'unrealisedPnl': '1.4711', 'markPrice': '0.2276', 'adlRankIndicator': 5, 'cumRealisedPnl': '-2.2321325', 'positionMM': '2.02821569', 'createdTime': '1737258659325', 'positionIdx': 0, 'positionIM': '5.02520969', 'seq': 62669249424, 'updatedTime': '1737944710078', 'side': 'Sell', 'bustPrice': '', 'positionBalance': '0', 'leverageSysUpdatedTime': '', 'curRealisedPnl': '-0.02689762', 'size': '213', 'positionStatus': 'Normal', 'mmrSysUpdatedTime': '', 'stopLoss': '', 'tradeMode': 0, 'sessionAvgPrice': ''}]


if __name__ == "__main__":
    #run to check if there is trend reversal on specified session

    with open("sessions.json", "r") as f:
        session_times = json.load(f)

    #change to session desired
    start = session_times["tokyo"]["start_epoch"]
    end = session_times["tokyo"]["end_epoch"]

    # fetched_kline = get_kline_data('BTCUSDT',5,start=start,end=end)

    # trend = get_market_trendline_slope(fetched_kline)

    market_trends = fetch_market_trends(start,end)
    print(market_trends)

    short_markets = filter_market_trends(market_trends, "short")  # Markets with positive slope
    long_markets = filter_market_trends(market_trends, "long")  # Markets with negative slope

    print("Short markets:", short_markets)
    print("Long markets:", long_markets)

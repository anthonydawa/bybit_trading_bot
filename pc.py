
from pybit.unified_trading import HTTP

# Replace these with your API credentials
API_KEY = "JAw1PgQ9yd2mN2kYtF"
API_SECRET = "KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM"

# Initialize the session (set testnet to True for test environment)
session = HTTP(
    testnet=False,  # Set to True if using the testnet
    api_key=API_KEY,
    api_secret=API_SECRET,
)

try:
    # Request wallet balance for USDT
    response = session.get_wallet_balance(accountType="UNIFIED", coin="USDT")
    if response["retCode"] == 0:
        balance_data = response["result"]["list"][0]["coin"][0]
        usdt_balance = balance_data["walletBalance"]
        available_balance = balance_data["availableToWithdraw"]
        print(f"USDT Wallet Balance: {usdt_balance}")
        print(f"Available to Withdraw: {available_balance}")
    else:
        print(f"Error: {response['retMsg']}")
except Exception as e:
    print(f"An exception occurred: {e}")

def calculate_order_positions(
    api_key,
    api_secret,
    min_positions=5,
    max_positions=12,
    min_order_value=20,
    leverage=10,
    testnet=False,
):
    """
    Calculate the total value and number of positions for leveraged orders based on wallet balance.
    
    :param api_key: Bybit API Key
    :param api_secret: Bybit API Secret
    :param min_positions: Minimum number of positions to open (default is 5)
    :param max_positions: Maximum number of positions to open (default is 12)
    :param min_order_value: Minimum order value per position (default is $20)
    :param leverage: Leverage to apply (default is 10x)
    :param testnet: Whether to use Bybit's testnet (default is False)
    :return: A dictionary with the total order value and positions details
    """
    # Initialize the session
    session = HTTP(
        testnet=testnet,
        api_key=api_key,
        api_secret=api_secret,
    )
    
    try:
        # Fetch USDT wallet balance
        response = session.get_wallet_balance(accountType="UNIFIED", coin="USDT")
        if response["retCode"] != 0:
            return {"error": f"API Error: {response['retMsg']}"}
        
        usdt_balance = float(response["result"]["list"][0]["coin"][0]["walletBalance"])
        available_balance = float(response["result"]["list"][0]["coin"][0]["availableToWithdraw"])
        
        # Calculate total leveraged value
        total_order_value = available_balance * leverage
        
        # Ensure minimum order constraints
        max_possible_positions = total_order_value // min_order_value
        num_positions = min(max_positions, max(min_positions, int(max_possible_positions)))
        
        # Calculate position size
        if num_positions > 0:
            position_size = total_order_value / num_positions
            
        else:
            return {"error": "Insufficient balance to meet minimum order requirements."}
        
        return {
            "usdt_balance": usdt_balance,
            "available_balance": available_balance,
            "leverage": leverage,
            "total_order_value": total_order_value,
            "num_positions": int(num_positions),
            "position_size": round(position_size, 2),
        }
    except Exception as e:
        return {"error": str(e)}


# Example Usage
if __name__ == "__main__":

    result = calculate_order_positions(
        api_key="JAw1PgQ9yd2mN2kYtF",
        api_secret="KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM",
    )
    
    if "error" in result:
        print(result["error"])
    else:
        print(f"USDT Balance: {result['usdt_balance']}")
        print(f"Available Balance: {result['available_balance']}")
        print(f"Leverage: {result['leverage']}x")
        print(f"Total Order Value: ${result['total_order_value']}")
        print(f"Number of Positions: {result['num_positions']}")
        print(f"Position Size: ${result['position_size']} per position")


# from pybit.unified_trading import HTTP

# # Initialize session
# session = HTTP()

# def get_kline_data(symbol, interval, category="linear", start=None, end=None):
#     """
#     Fetches kline (candlestick) data for a given symbol and interval, reversing the order to most recent first.

#     :param symbol: str - The trading pair symbol, e.g., "BTCUSDT".
#     :param interval: int - The time interval for the kline data, e.g., 5 (minutes).
#     :param category: str - The trading category, default is "linear".
#     :param start: int or None - Start timestamp in milliseconds. Default is None.
#     :param end: int or None - End timestamp in milliseconds. Default is None.
#     :return: list - The kline data reversed and excluding the first entry.
#     """
#     try:
#         # Prepare the request parameters
#         params = {
#             "category": category,
#             "symbol": symbol,
#             "interval": interval,
#             "limit": 300
#         }
#         # Include start and end if provided
#         if start:
#             params["start"] = start
#         if end:
#             params["end"] = end
        
#         # Make the API call
#         response = session.get_kline(**params)
        
#         # Reverse the kline data and exclude the first entry
#         return list(reversed(response['result']['list'][1:]))
#     except Exception as e:
#         return {"error": str(e)}

# def calculate_mean_close(kline_data):
#     """
#     Calculates the mean of closing prices from kline data.

#     :param kline_data: list - The kline data returned by get_kline_data.
#     :return: float - The mean of the closing prices.
#     """
#     try:
#         # Extract the closing prices (list[4] is closePrice)
#         closing_prices = [float(candle[4]) for candle in kline_data]
#         # Calculate and return the mean
#         mean_close = sum(closing_prices) / len(closing_prices) if closing_prices else None
#         return mean_close
#     except Exception as e:
#         return {"error": str(e)}

# # Example usage
# if __name__ == "__main__":
#     # Fetch kline data
#     kline_data = get_kline_data(symbol="BTCUSDT", interval=5,start=1737590400000,end=1737622800000)
    
#     if "error" in kline_data:
#         print(f"Error fetching kline data: {kline_data['error']}")
#     else:
#         # Calculate the mean of closing prices
#         mean_close = calculate_mean_close(kline_data)
#         print(f"The mean closing price is: {mean_close}")

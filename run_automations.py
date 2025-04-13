from get_breakout_markets import process_breakout_markets
from get_bybit_markets import get_usdt_derivatives_markets
from get_volatile_markets import get_volatile_markets
from open_order_best_markets import place_bulk_orders
import schedule
import time
from datetime import datetime, timezone, timedelta

# Import your functions
from get_market_trend import calculate_and_save_trendline_slopes
from get_qualified_markets import get_qualified_markets
from get_qualified_markets2 import get_qualified_markets2
from get_session_epoch import get_trading_session_epochs, get_yesterday_trading_session_epochs
from market_filter_rsi import evaluate_sessions
from get_position_data import update_trades_csv
from handle_market_orders import update_market_stop_loss, update_markets_file
from handle_markets_mark_close import update_mark_close
from place_bulk_orders_risk import place_bulk_orders_with_risk
from run_trading_bot import trading_bot
from helper_functions import compare_csv_rows, find_pair_markets, remove_lower_half, remove_session_from_csv


NUM_MARKETS = 12
ORDER_VALUE = 100
RISK_VALUE = 1


from pybit.unified_trading import HTTP

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


# # Example Usage
# if __name__ == "__main__":

#     result = calculate_order_positions(
#         api_key="JAw1PgQ9yd2mN2kYtF",
#         api_secret="KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM",
#     )
    
#     if "error" in result:
#         print(result["error"])
#     else:
#         print(f"USDT Balance: {result['usdt_balance']}")
#         print(f"Available Balance: {result['available_balance']}")
#         print(f"Leverage: {result['leverage']}x")
#         print(f"Total Order Value: ${result['total_order_value']}")
#         print(f"Number of Positions: {result['num_positions']}")
#         print(f"Position Size: ${result['position_size']} per position")


def main():
    # First step
    get_usdt_derivatives_markets()
    get_yesterday_trading_session_epochs()
    get_trading_session_epochs()

    evaluate_sessions(5)
    calculate_and_save_trendline_slopes(['sydney', 'tokyo'])
    excluded_markets_list = ["USDEUSDT", "USDCUSDT","SILLYUSDT","BIOUSDT","RUNEUSDT"]  # Replace with actual markets to exclude
    get_qualified_markets(["tokyo", "sydney"], check_rsi=False, check_trend=False, excluded_markets=excluded_markets_list)
    get_qualified_markets2(["tokyo", "sydney"], check_rsi=False, check_trend=False, excluded_markets=excluded_markets_list)
    remove_lower_half('buy_trades/long_trades.csv')
    remove_lower_half('sell_trades/short_trades.csv')
    get_volatile_markets()
    remove_lower_half('buy_trades/volatile_long_trades.csv')
    remove_lower_half('sell_trades/volatile_short_trades.csv')
    find_pair_markets('buy_trades/long_trades.csv','usdt_markets_bbw.csv','buy_trades/volatile_long_trades.csv')
    find_pair_markets('sell_trades/short_trades.csv','usdt_markets_bbw.csv','sell_trades/volatile_short_trades.csv')
    process_breakout_markets('sell_trades/short_trades.csv','sell_trades/breakout_short_trades.csv',position="short",filter_mode='all')
    process_breakout_markets('buy_trades/long_trades.csv','buy_trades/breakout_long_trades.csv',position="long",filter_mode='all')
    market_bias = compare_csv_rows()
    #remove if needed
    # if market_bias == "Buy":
    #     remove_session_from_csv('buy_trades/long_trades.csv','tokyo')
    # elif market_bias == "Sell":
    #     remove_session_from_csv('sell_trades/short_trades.csv','tokyo')

    print('bias '+ market_bias)
    # place_bulk_orders(num_markets=NUM_MARKETS, order_value=ORDER_VALUE, side=market_bias)
    place_bulk_orders_with_risk(num_markets=NUM_MARKETS,risk_amount=RISK_VALUE,side=market_bias)
    update_trades_csv(api_key="JAw1PgQ9yd2mN2kYtF",api_secret="KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM",filename="markets.csv")
    print('Market position updated')
    update_market_stop_loss('markets.csv', 'sessions.json', 'sydney')
    print('Stop loss updated')
    update_mark_close(csv="markets.csv")
    print('Market position updated')
    trading_bot()

# Schedule the function to run at 12:00 PM PHT
def schedule_task():
    # Define PHT timezone
    pht_timezone = timezone(timedelta(hours=8))  # UTC+8
    now = datetime.now(pht_timezone)
    print(f"Current time in PHT: {now.strftime('%Y-%m-%d %H:%M:%S')}")

    # Schedule the task
    schedule.every().day.at("10:30").do(main)

    print(f"Scheduler started. Waiting for 12:00 PM PHT...")
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    schedule_task()

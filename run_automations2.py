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
from handle_market_orders import update_market_stop_loss
from handle_markets_mark_close import update_mark_close
from place_bulk_orders_risk import place_bulk_orders_with_risk
from run_trading_bot_no_atr import trading_bot
from helper_functions import compare_csv_rows, find_pair_markets, remove_lower_half

NUM_MARKETS = 4
ORDER_VALUE = 100
RISK_VALUE = 0.5

def main():
    # First step
    get_usdt_derivatives_markets()
    get_yesterday_trading_session_epochs()
    get_trading_session_epochs()
    evaluate_sessions(5)
    calculate_and_save_trendline_slopes(['sydney', 'tokyo'])
    excluded_markets_list = ["USDEUSDT", "USDCUSDT","SILLYUSDT","BIOUSDT","RUNEUSDT","GOMININGUSDT"]  # Replace with actual markets to exclude
    get_qualified_markets(["tokyo", "sydney"], check_rsi=False, check_trend=False, excluded_markets=excluded_markets_list)
    get_qualified_markets2(["tokyo", "sydney"], check_rsi=False, check_trend=True, excluded_markets=excluded_markets_list)
    remove_lower_half('buy_trades/long_trades.csv')
    remove_lower_half('sell_trades/short_trades.csv')
    get_volatile_markets()
    remove_lower_half('buy_trades/volatile_long_trades.csv')
    remove_lower_half('sell_trades/volatile_short_trades.csv')
    find_pair_markets('buy_trades/long_trades.csv','usdt_markets_bbw.csv','buy_trades/volatile_long_trades.csv')
    find_pair_markets('sell_trades/short_trades.csv','usdt_markets_bbw.csv','sell_trades/volatile_short_trades.csv')
    process_breakout_markets('sell_trades/short_trades.csv','sell_trades/breakout_short_trades.csv',position="short",filter_mode='any')
    process_breakout_markets('buy_trades/long_trades.csv','buy_trades/breakout_long_trades.csv',position="long",filter_mode='any')
    market_bias = compare_csv_rows()
    place_bulk_orders_with_risk(num_markets=NUM_MARKETS,risk_amount=RISK_VALUE,side=market_bias)
    update_trades_csv(api_key="JAw1PgQ9yd2mN2kYtF",api_secret="KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM",filename="markets2.csv")
    update_market_stop_loss('markets2.csv', 'sessions.json', 'sydney')
    trading_bot()

# Schedule the function to run at 12:00 PM PHT
def schedule_task():
    # Define PHT timezone
    pht_timezone = timezone(timedelta(hours=8))  # UTC+8
    now = datetime.now(pht_timezone)
    print(f"Current time in PHT: {now.strftime('%Y-%m-%d %H:%M:%S')}")

    # Schedule the task
    schedule.every().day.at("10:00").do(main)

    print(f"Scheduler started. Waiting for 12:00 PM PHT...")
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    schedule_task()

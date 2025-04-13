from get_breakout_markets import process_breakout_markets
from get_bybit_markets import get_usdt_derivatives_markets
from get_market_trend import calculate_and_save_trendline_slopes
from get_qualified_markets import get_qualified_markets
from get_qualified_markets2 import get_qualified_markets2
from get_session_epoch import get_trading_session_epochs, get_yesterday_trading_session_epochs
from get_volatile_markets import get_volatile_markets
from helper_functions import find_pair_markets, remove_lower_half, remove_session_from_csv
from market_filter_rsi import evaluate_sessions



if __name__ == "__main__":

    # first step
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
    # remove_session_from_csv('sell_trades/short_trades.csv','tokyo')
    # remove_session_from_csv('buy_trades/long_trades.csv','tokyo')
    get_volatile_markets()
    # remove_lower_half('buy_trades/volatile_long_trades.csv')
    # remove_lower_half('sell_trades/volatile_short_trades.csv')
    find_pair_markets('buy_trades/long_trades.csv','usdt_markets_bbw.csv','buy_trades/volatile_long_trades.csv')
    find_pair_markets('sell_trades/short_trades.csv','usdt_markets_bbw.csv','sell_trades/volatile_short_trades.csv')
    process_breakout_markets('sell_trades/short_trades.csv','sell_trades/breakout_short_trades.csv',position="short",filter_mode='any')
    process_breakout_markets('buy_trades/long_trades.csv','buy_trades/breakout_long_trades.csv',position="long",filter_mode='any')
    #2nd step
    # 1. check the buy trades and sell trades folder for the qualified trades
    # 2. enter the trades on bybit
    # 3. input the the trades you entered on markets.csv
    # 4. run the bot
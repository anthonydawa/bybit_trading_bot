from get_position_data import update_trades_csv
from handle_market_orders import update_market_stop_loss, update_markets_file
from handle_markets_mark_close import update_mark_close
from run_trading_bot2 import trading_bot

#2nd step
# 1. check the buy trades and sell trades folder for the qualified trades
# 2. enter the trades on bybit
# 3. input the the trades you entered on markets.csv
# 4. run the bot

if __name__ == "__main__":

    update_trades_csv(api_key="JAw1PgQ9yd2mN2kYtF",api_secret="KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM",filename="markets3.csv")
    update_market_stop_loss('markets3.csv', 'sessions.json', 'sydney')

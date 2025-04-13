import time
import csv
import logging
from pybit.unified_trading import HTTP
from atr_indicator import calculate_atr
from backtest.backtestv1_functions import get_bollinger_bands, get_bollinger_bands_width
from helper_functions import remove_symbol
from kline_utils import get_kline_data  # Import reusable kline function
from order_utils import place_order, place_order_return_qty    # Import reusable place order function

# CSV file to store market data
MARKET_FILE = "markets_bb.csv"
LOG_FILE = "trading_bot.log"

# Bot configuration
INTERVAL = 5
LOOP_INTERVAL = 0.5  # Seconds
RISK_PER_TRADE = 0.5 #in dollars

# Configure logging
logging.basicConfig(filename=LOG_FILE, level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def calculate_order_size(current_price, stop_price, risk_amount):
    """
    Calculate the order size in USD needed to achieve the desired risk amount.

    :param current_price: float, the current price of the asset
    :param stop_price: float, the price at which the stop-loss is triggered
    :param risk_amount: float, the amount you're willing to risk in USD
    :return: float, the order size in USD
    """
    if stop_price == current_price:
        raise ValueError("Stop price cannot be equal to the current price.")

    # Calculate the price difference per unit
    price_difference = abs(current_price - stop_price)

    # Calculate the amount of the asset to buy or sell based on the price difference and risk amount
    order_qty = risk_amount / price_difference

    # Calculate the order size in USD (price * quantity)
    order_size_in_usd = current_price * order_qty
    return order_size_in_usd

def load_markets_from_file():
    """Load market data from the CSV file."""
    markets = []
    try:
        with open(MARKET_FILE, mode="r") as file:
            reader = csv.DictReader(file)
            for row in reader:
                markets.append({
                    "symbol": row["symbol"],
                    "qty": row["qty"],
                    "position": row["position"],
                    "stop_loss": float(row["stop_loss"]),
                    "take_profit": float(row["take_profit"]),
                    "tp_atr_multiplier": float(row["tp_atr_multiplier"]),
                    "sl_atr_multiplier": float(row["sl_atr_multiplier"]),
                    "bbw": float(row["bbw"]),
                    "bb_period": float(row["bb_period"]),
                    "bb_dev": float(row["bb_dev"]),
                })
    except FileNotFoundError:
        print(f"{MARKET_FILE} not found. Starting with an empty market list.")
    return markets

def save_markets_to_file(markets):
    """Save the updated market data to the CSV file."""
    fieldnames = ["symbol", "qty", "position", "stop_loss","take_profit","bbw","tp_atr_multiplier","sl_atr_multiplier","bb_period","bb_dev"]
    try:
        with open(MARKET_FILE, mode="w", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            for market in markets:
                writer.writerow({
                    "symbol": market["symbol"],
                    "qty": market["qty"],
                    "position": market["position"],
                    "stop_loss": market["stop_loss"],
                    "take_profit": market["take_profit"],
                    "tp_atr_multiplier": market["tp_atr_multiplier"],
                    "sl_atr_multiplier" : market["sl_atr_multiplier"],
                    "bbw": market["bbw"],
                    "bb_period": market['bb_period'],
                    "bb_dev":market["bb_dev"]
                })
        print("Markets successfully saved to file.")
    except Exception as e:
        print(f"Error saving markets to file: {e}")

def trading_bot(NUM_MARKETS=None):
    """Main trading bot loop with session-based strategies."""
    markets = load_markets_from_file()
    while True:
        try:
            markets = load_markets_from_file()
            if NUM_MARKETS is not None:
                active_positions = sum(1 for market in markets if market["status"] == "open")
                if active_positions < 0.3 * NUM_MARKETS:
                    print(f"Active positions ({active_positions}) are less than 30% of total markets ({NUM_MARKETS}). Closing all trades.")
                    break
            
            for market in markets:

                symbol = market["symbol"]
                qty = market["qty"]
                position = market["position"]
                stop_loss = market["stop_loss"]
                take_profit = market["take_profit"]

                kline_data = get_kline_data(symbol=symbol, interval=INTERVAL)

                if "error" in kline_data:
                    print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
                    continue

                average_true_range = calculate_atr(kline_data)
                upper_band, lower_band = get_bollinger_bands(kline_data,market['bb_period'],market['bb_dev'])
                bollinger_bands_width = get_bollinger_bands_width(kline_data)
            
                current_price = float(kline_data[-1][4])
                current_high = float(kline_data[-1][2])
                current_low = float(kline_data[-1][3])

                # print(f"Processing market: {symbol}, Current Price: {current_price}, Position: {position}")

                # watch stop loss
                if position == "long" and current_price < stop_loss:
                    if current_low <= lower_band and market['bbw'] <= bollinger_bands_width:
                        print(f"Removing symbol {symbol} from markets due to stop loss and BB width condition.")
                        logging.info(f"Removing symbol {symbol} from markets due to stop loss and BB width condition.")
                        remove_symbol(market['symbol'], 'markets_bb.csv')
                        continue
                    else:
                        print(f"Stop loss hit for {symbol}. Closing position.")
                        logging.info(f"Stop loss hit for {symbol}. Closing position.")
                        order_response = place_order(symbol=symbol, qty=qty, side="Sell")

                        if order_response:
                            print(f"Order response: {order_response}")
                            logging.info(f"Order response: {order_response}")
                            market["position"] = "none"
                            market["qty"] = 0
                            market["take_profit"] = 0
                            market["stop_loss"] = 0
                            save_markets_to_file(markets)
                            continue

                elif position == "short" and current_price > stop_loss:
                    if current_high >= upper_band and market['bbw'] <= bollinger_bands_width:
                        print(f"Removing symbol {symbol} from markets due to stop loss and BB width condition.")
                        logging.info(f"Removing symbol {symbol} from markets due to stop loss and BB width condition.")
                        remove_symbol(market['symbol'], 'markets_bb.csv')
                        continue
                    else:
                        print(f"Stop loss hit for {symbol}. Closing position.")
                        logging.info(f"Stop loss hit for {symbol}. Closing position.")
                        order_response = place_order(symbol=symbol, qty=qty, side="Buy")
                        

                        if order_response:
                            print(f"Order response: {order_response}")
                            logging.info(f"Order response: {order_response}")
                            market["position"] = "none"
                            market["qty"] = 0
                            market["take_profit"] = 0
                            market["stop_loss"] = 0
                            save_markets_to_file(markets)
                            continue

                # watch take profit
                if position == "long" and current_price > take_profit:
                    print(f"Take profit hit for {symbol}. Closing position.")
                    logging.info(f"Take profit hit for {symbol}. Closing position.")
                    order_response = place_order(symbol=symbol, qty=qty, side="Sell")

                    if order_response:
                        print(f"Order response: {order_response}")
                        logging.info(f"Order response: {order_response}")
                        market["position"] = "none"
                        market["qty"] = 0
                        market["take_profit"] = 0
                        market["stop_loss"] = 0
                        save_markets_to_file(markets)
                        continue

                elif position == "short" and current_price < take_profit:
                    print(f"Take profit hit for {symbol}. Closing position.")
                    logging.info(f"Take profit hit for {symbol}. Closing position.")
                    order_response = place_order(symbol=symbol, qty=qty, side="Buy")

                    if order_response:
                        print(f"Order response: {order_response}")
                        logging.info(f"Order response: {order_response}")
                        market["position"] = "none"
                        market["qty"] = 0
                        market["take_profit"] = 0
                        market["stop_loss"] = 0
                        save_markets_to_file(markets)
                        continue

                # Check for short trade opportunity
                if position == "none":

                    if current_high >= upper_band and market['bbw'] <= bollinger_bands_width:
                        print(f"High went above the upper band for {symbol}. Entering short position.")
                        logging.info(f"High went above the upper band for {symbol}. Entering short position.")
                        
                        sl = current_price + average_true_range * market['sl_atr_multiplier']
                        tp = current_price - average_true_range * market['tp_atr_multiplier']

                        usd_value = calculate_order_size(current_price=current_price,stop_price=sl,risk_amount=RISK_PER_TRADE)
                        order_response = place_order_return_qty(symbol=symbol, usdt=usd_value, side="Sell")

                        if order_response:
                            print(f"Order response: {order_response}")
                            logging.info(f"Order response: {order_response}")
                            market["position"] = "short"
                            market["stop_loss"] = sl
                            market["take_profit"] = tp
                            market["qty"] = order_response
                            save_markets_to_file(markets)

                    # Check for long trade opportunity
                    elif current_low <= lower_band and market['bbw'] <= bollinger_bands_width:
                        print(f"Low went below the lower band for {symbol}. Entering long position.")
                        logging.info(f"Low went below the lower band for {symbol}. Entering long position.")

                        sl = current_price - average_true_range * market['sl_atr_multiplier']
                        tp = current_price + average_true_range * market['tp_atr_multiplier']

                        usd_value = calculate_order_size(current_price=current_price,stop_price=sl,risk_amount=RISK_PER_TRADE)
                        order_response = place_order_return_qty(symbol=symbol, usdt=usd_value, side="Buy")

                        if order_response:
                            print(f"Order response: {order_response}")
                            logging.info(f"Order response: {order_response}")
                            market["position"] = "long"
                            market["stop_loss"] = sl
                            market["take_profit"] = tp
                            market["qty"] = order_response
                            save_markets_to_file(markets)

        except Exception as e:
            print(f"An error occurred: {str(e)}")
            logging.error(f"An error occurred: {str(e)}")

        time.sleep(LOOP_INTERVAL)

if __name__ == "__main__":
    print("Starting Trading Bot...")
    trading_bot()
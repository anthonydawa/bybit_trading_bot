import csv
import os
import json
from order_utils import place_order
from kline_utils import get_kline_data

try:
    from pybit.unified_trading import HTTP
except ModuleNotFoundError:
    raise ImportError("The 'pybit' module is not installed. Please install it using 'pip install pybit' before running this script.")

def place_bulk_orders_with_risk(num_markets, risk_amount, side, category="linear"):
    """
    Places bulk orders for the top N markets from a CSV file using a risk amount to determine order value.

    :param num_markets: int - The number of markets to include in the orders.
    :param risk_amount: float - The amount you're willing to risk in USD per order.
    :param side: str - The order side, "Buy" or "Sell".
    :param category: str - The trading category, default is "linear".
    :return: list - A list of results for each order placed.
    """
    API_KEY = "JAw1PgQ9yd2mN2kYtF"
    API_SECRET = "KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM"

    def fetch_all_positions():
        session = HTTP(
            testnet=False,
            api_key=API_KEY,
            api_secret=API_SECRET,
        )
        positions = []
        next_page_cursor = None

        while True:
            response = session.get_positions(
                category="linear",
                settleCoin="USDT",
                cursor=next_page_cursor,
            )

            if response.get("retCode") != 0:
                print("Error fetching data:", response.get("retMsg"))
                break

            positions.extend(response.get("result", {}).get("list", []))

            next_page_cursor = response.get("result", {}).get("nextPageCursor")
            if not next_page_cursor:
                break

        return {position["symbol"] for position in positions if float(position["size"]) > 0}

    def get_risk_order(symbol, side, risk_amount):
        try:
            with open("sessions.json", "r") as file:
                session_data = json.load(file)
        except Exception as e:
            print(f"Error loading session data: {e}")
            return None

        if "sydney" not in session_data:
            print("Sydney session data not found in sessions.json.")
            return None

        SYDNEY_START_EPOCH = session_data["sydney"]["start_epoch"]
        SYDNEY_END_EPOCH = session_data["sydney"]["end_epoch"]

        kline_data = get_kline_data(symbol=symbol, interval=5, start=SYDNEY_START_EPOCH, end=SYDNEY_END_EPOCH)

        if not kline_data or not isinstance(kline_data, list):
            print(f"No valid kline data available for symbol: {symbol}")
            return None

        try:
            latest_candle = kline_data[-1]
            latest_price = float(latest_candle[4])
            highest_high = max(float(candle[2]) for candle in kline_data)
            lowest_low = min(float(candle[3]) for candle in kline_data)

            stop_price = lowest_low if side.lower() == "buy" else highest_high

            return calculate_order_size(latest_price, stop_price, risk_amount)
        except (ValueError, IndexError) as e:
            print(f"Error processing Kline data: {e}")
            return None

    def calculate_order_size(current_price, stop_price, risk_amount):
        if stop_price == current_price:
            raise ValueError("Stop price cannot be equal to the current price.")

        price_difference = abs(current_price - stop_price)
        order_qty = risk_amount / price_difference
        order_size_in_usd = current_price * order_qty
        return order_size_in_usd

    open_positions = fetch_all_positions()

    file_path = os.path.join("buy_trades", "breakout_long_trades.csv") if side == "Buy" else os.path.join("sell_trades", "breakout_short_trades.csv")
    # file_path = os.path.join("buy_trades", "volatile_long_trades.csv") if side == "Buy" else os.path.join("sell_trades", "volatile_short_trades.csv")

    placed_orders = []
    processed_markets = set()

    try:
        with open(file_path, mode="r") as file:
            reader = csv.DictReader(file)
            markets = [row["Market"] for row in reader]

            selected_markets = []
            for market in markets:
                if market not in processed_markets and market not in open_positions:
                    selected_markets.append(market)
                    processed_markets.add(market)
                if len(selected_markets) == num_markets:
                    break

            if len(selected_markets) < num_markets:
                for market in markets:
                    if market not in selected_markets and market not in open_positions:
                        selected_markets.append(market)
                    if len(selected_markets) == num_markets:
                        break

            for market in selected_markets:
                order_value = get_risk_order(market, side, risk_amount)
                if order_value:
                    result = place_order(
                        symbol=market,
                        usdt=order_value,
                        side=side,
                        order_type="Market",
                        time_in_force="PostOnly",
                        order_filter="Order",
                        category=category,
                    )
                    placed_orders.append({"market": market, "result": result})
                    print(f"Order placed for {market}: {result}")

    except FileNotFoundError:
        print(f"File not found: {file_path}")
        return {"error": "File not found."}
    except Exception as e:
        print(f"Error processing file: {str(e)}")
        return {"error": str(e)}

    return placed_orders

# Example usage
if __name__ == "__main__":
    top_markets = 4
    risk_per_order = 0.5
    order_side = "Sell"

    excluded_list = excluded_markets_list = ["USDEUSDT", "USDCUSDT","SILLYUSDT","BIOUSDT","RUNEUSDT","GOMININGUSDT"] 

    results = place_bulk_orders_with_risk(
        num_markets=top_markets,
        risk_amount=risk_per_order,
        side=order_side,
        
    )
    print("Bulk order results:", results)
import json
from kline_utils import get_kline_data


def get_risk_order(symbol, side, risk_amount):
    """
    Calculate the order size based on the trading symbol, side, and risk amount.

    :param symbol: str, the trading symbol (e.g., BTCUSDT)
    :param side: str, "Buy" or "Sell" indicating the trade direction
    :param risk_amount: float, the amount you're willing to risk in USD
    :return: float, the calculated order size
    """
    try:
        with open("sessions.json", "r") as file:
            session_data = json.load(file)
    except Exception as e:
        print(f"Error loading session data: {e}")
        return None

    # Check if Sydney session data is available
    if "sydney" not in session_data:
        print("Sydney session data not found in sessions.json.")
        return None

    SYDNEY_START_EPOCH = session_data["sydney"]["start_epoch"]
    SYDNEY_END_EPOCH = session_data["sydney"]["end_epoch"]

    # Fetch kline data for the given symbol and session timeframe
    kline_data = get_kline_data(symbol=symbol, interval=5, start=SYDNEY_START_EPOCH, end=SYDNEY_END_EPOCH)

    if not kline_data or not isinstance(kline_data, list):
        print(f"No valid kline data available for symbol: {symbol}")
        return None

    try:
        # Extract the latest price, highest high, and lowest low from kline data
        latest_candle = kline_data[-1]
        latest_price = float(latest_candle[4])  # Close price
        highest_high = max(float(candle[2]) for candle in kline_data)  # High prices
        lowest_low = min(float(candle[3]) for candle in kline_data)  # Low prices

        # Determine the stop price based on the trade side
        stop_price = lowest_low if side.lower() == "buy" else highest_high

        # Validate inputs and calculate order size
        result = calculate_order_size(latest_price, stop_price, risk_amount)
    except (ValueError, IndexError) as e:
        print(f"Error processing Kline data: {e}")
        return None

    return result

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


# Example Usage
if __name__ == "__main__":
    symbol = "BTCUSDT"
    side = "Buy"  # "Buy" or "Sell"
    risk_amount = 500.0  # USD

    order_size = get_risk_order(symbol, side, risk_amount)
    if order_size:
        print(f"Order size for {symbol} ({side}): ${order_size:.2f}")

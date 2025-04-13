

from pybit.unified_trading import HTTP

# Initialize session with API key and secret
session = HTTP(
    api_key="JAw1PgQ9yd2mN2kYtF",
    api_secret="KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM",
)

def get_lot_size(symbol, category="linear"):
    """
    Retrieves the lot size filter for a given symbol.
    """
    try:
        response = session.get_instruments_info(category=category, symbol=symbol)
        if "result" in response and response["result"]["list"]:
            instrument_info = response["result"]["list"][0]
            lot_size_filter = instrument_info.get("lotSizeFilter", {})
            return {
                "minOrderQty": float(lot_size_filter.get("minOrderQty", 0)),
                "maxOrderQty": float(lot_size_filter.get("maxOrderQty", 0)),
                "qtyStep": float(lot_size_filter.get("qtyStep", 0)),
            }
        else:
            raise Exception(f"Symbol {symbol} not found in category {category}.")
    except Exception as e:
        raise Exception(f"Error fetching lot size: {str(e)}")

def get_market_price(symbol, category="linear"):
    """
    Retrieves the latest market price for a given symbol.
    """
    try:
        response = session.get_tickers(category=category, symbol=symbol)
        if "result" in response and response["result"]["list"]:
            return float(response["result"]["list"][0]["lastPrice"])
        else:
            raise Exception(f"Price for {symbol} not found.")
    except Exception as e:
        raise Exception(f"Error fetching market price: {str(e)}")

def validate_quantity(quantity, lot_size):
    """
    Validates the calculated quantity based on the lot size filter.
    """
    min_qty = lot_size["minOrderQty"]
    max_qty = lot_size["maxOrderQty"]
    qty_step = lot_size["qtyStep"]

    if quantity < min_qty or quantity > max_qty:
        return False

    # Align quantity with the step size
    quantity = round(((quantity - min_qty) // qty_step) * qty_step + min_qty, 8)
    return quantity

def place_order(symbol, qty=None, usdt=None, side="Buy", order_type="Market", time_in_force="PostOnly", order_filter="Order", category="linear"):
    """
    Places an order using the Bybit Unified Trading API with error handling and success code validation.
    
    :param symbol: str - The trading pair symbol, e.g., "BTCUSDT".
    :param qty: str - The quantity to trade.
    :param usdt: float - The USDT value to trade.
    :param side: str - The order side, "Buy" or "Sell".
    :param order_type: str - The type of order, default is "Market".
    :param time_in_force: str - The time in force, default is "PostOnly".
    :param order_filter: str - The order filter, default is "Order".
    :param category: str - The trading category, default is "linear".
    :return: dict - The response from the API, including error details if the order fails.
    """
    try:
        print(f"Placing order: Symbol={symbol}, Side={side}, Qty={qty}, USDT={usdt}, OrderType={order_type}")

        if usdt:
            print(f"Calculating quantity from USDT: {usdt}")
            price = get_market_price(symbol, category)
            lot_size = get_lot_size(symbol, category)

            if price is None or lot_size is None:
                raise ValueError(f"Failed to retrieve market price ({price}) or lot size ({lot_size}) for {symbol}.")

            calculated_qty = usdt / price
            qty = validate_quantity(calculated_qty, lot_size)

            if not qty:
                raise ValueError(f"Invalid calculated quantity {calculated_qty} from USDT {usdt}.")

        elif qty is None:
            raise ValueError("Either 'qty' or 'usdt' must be provided.")

        print(f"Final Order Qty: {qty}")

        # Place order
        response = session.place_order(
            category=category,
            symbol=symbol,
            side=side,
            orderType=order_type,
            qty=qty,
            timeInForce=time_in_force,
            orderFilter=order_filter,
        )

        # Check for API success
        if response.get("retCode") != 0:
            raise ValueError(f"Order API Error: {response.get('retMsg', 'Unknown error')}, Response: {response}")

        print(f"Order placed successfully: {response}")
        return response

    except Exception as e:
        error_msg = f"Error placing order for {symbol}: {str(e)}"
        print(error_msg)
        return {"error": error_msg}

    
    
def place_order_return_qty(symbol, qty=None, usdt=None, side="Buy", order_type="Market", time_in_force="PostOnly", order_filter="Order", category="linear"):
    """
    Places an order using the Bybit Unified Trading API.
    
    :return: dict - The response from the API if successful, or an error dict if failed.
    """
    try:
        if usdt:
            price = get_market_price(symbol, category)
            lot_size = get_lot_size(symbol, category)
            calculated_qty = usdt / price
            qty = validate_quantity(calculated_qty, lot_size)
            if not qty:
                raise ValueError(f"Calculated quantity {calculated_qty} from USDT {usdt} is not valid.")
        
        elif qty is None:
            raise ValueError("Either 'qty' or 'usdt' must be provided.")

        # Place order
        response = session.place_order(
            category=category,
            symbol=symbol,
            side=side,
            orderType=order_type,
            qty=qty,
            timeInForce=time_in_force,
            orderFilter=order_filter,
        )

        # Ensure order was successfully placed
        if response.get("retCode") == 0:  # Check API success code
            print("Order placed successfully:", response)
            return qty  # Return quantity only if order is successful
        else:
            print("Order failed:", response)
            return None  # Return None if the order fails

    except Exception as e:
        print("Order exception:", str(e))
        return None  # Ensure failure returns None


# Example usage
if __name__ == "__main__":
    # Market order with USDT value
    response_usdt = place_order(symbol="AIXBTUSDT", usdt=9, side="Buy")
    print("Order using USDT:", response_usdt)

    # # Market order with quantity
    # response_qty = place_order(symbol="BTCUSDT", qty="0.001", side="Buy")
    # print("Order using quantity:", response_qty)

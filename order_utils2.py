# from pybit.unified_trading import HTTP

# # Initialize session with API key and secret
# session = HTTP(
#     api_key="JAw1PgQ9yd2mN2kYtF",
#     api_secret="KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM",
# )

# def place_order(symbol, qty, side, order_type="Market", time_in_force="PostOnly", order_filter="Order", category="linear"):
#     """
#     Places an order using the Bybit Unified Trading API.

#     :param symbol: str - The trading pair symbol, e.g., "BTCUSDT".
#     :param qty: str - The quantity to trade, e.g., "0.001".
#     :param side: str - The order side, "Buy" or "Sell".
#     :param order_type: str - The type of order, default is "Market".
#     :param time_in_force: str - The time in force, default is "PostOnly".
#     :param order_filter: str - The order filter, default is "Order".
#     :param category: str - The trading category, default is "linear".
#     :return: dict - The response from the API.
#     """
#     try:
#         response = session.place_order(
#             category=category,
#             symbol=symbol,
#             side=side,
#             orderType=order_type,
#             qty=qty,
#             timeInForce=time_in_force,
#             orderFilter=order_filter,
#         )
#         return response
#     except Exception as e:
#         return {"error": str(e)}

# # Example usage
# if __name__ == "__main__":
#     result = place_order(symbol="BTCUSDT", qty="0.001", side="Buy")
#     print(result)


from pybit.unified_trading import HTTP

# Initialize session with API key and secret
session = HTTP(
    api_key="OUMKgLBu0yChE042UT",
    api_secret="yoomUECWOWDVk09KxzxlJGhh9rt5V1mF8BKl",
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
    Places an order using the Bybit Unified Trading API.
    
    :param symbol: str - The trading pair symbol, e.g., "BTCUSDT".
    :param qty: str - The quantity to trade.
    :param usdt: float - The USDT value to trade.
    :param side: str - The order side, "Buy" or "Sell".
    :param order_type: str - The type of order, default is "Market".
    :param time_in_force: str - The time in force, default is "PostOnly".
    :param order_filter: str - The order filter, default is "Order".
    :param category: str - The trading category, default is "linear".
    :return: dict - The response from the API.
    """
    try:
        if usdt:
            # Get the market price and lot size
            price = get_market_price(symbol, category)
            lot_size = get_lot_size(symbol, category)
            
            # Calculate quantity from USDT value
            calculated_qty = usdt / price
            
            # Validate the quantity
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
        return response
    except Exception as e:
        return {"error": str(e)}

# Example usage
if __name__ == "__main__":
    # Market order with USDT value
    response_usdt = place_order(symbol="AIXBTUSDT", usdt=20, side="Sell")
    print("Order using USDT:", response_usdt)

    # # Market order with quantity
    # response_qty = place_order(symbol="BTCUSDT", qty="0.001", side="Buy")
    # print("Order using quantity:", response_qty)

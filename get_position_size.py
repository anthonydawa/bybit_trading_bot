from pybit.unified_trading import HTTP

def get_position_info(symbol):
    # Initialize the session with your API keys
    session = HTTP(
        api_key="JAw1PgQ9yd2mN2kYtF",  # Replace with your actual API key
        api_secret="KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM",  # Replace with your actual API secret
    )

    # Get the positions data
    response = session.get_positions(
        category="linear",  # You can change to "inverse" if needed
        symbol=symbol
    )

    # Check if the response was successful
    if response["retCode"] == 0:
        # Extract the first position from the list (assuming you're querying one position)
        position = response["result"]["list"][0]

        # Extract the quantity and side (direction) of the position
        qty = position["size"]  # The position size (quantity)
        side = position["side"]  # The side of the position (Buy/Sell)

        return {"qty": qty, "side": side}
    else:
        return {"error": response["retMsg"]}



if __name__ == "__main__":# Example usage
    symbol = "BTCUSDT"
    position_info = get_position_info(symbol)
    print(position_info)

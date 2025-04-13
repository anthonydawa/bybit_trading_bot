from pybit.unified_trading import HTTP

# Initialize the session
session = HTTP(
    testnet=False,  # Set to False for mainnet
    api_key="JAw1PgQ9yd2mN2kYtF",
    api_secret="KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM"
)

# Step 1: Fetch open positions
def get_open_positions():
    # Fetch all positions with the required parameters
    response = session.get_positions(category="linear")  # Adjust category if needed
    if response["retCode"] == 0:
        return response["result"]["list"]
    else:
        raise Exception(f"Error fetching positions: {response['retMsg']}")

# Step 2: Check and update leverage for open positions
def update_leverage_to_max():
    positions = get_open_positions()
    for position in positions:
        symbol = position["symbol"]
        current_buy_leverage = float(position["buyLeverage"])
        current_sell_leverage = float(position["sellLeverage"])

        # Step 3: Get max leverage for the symbol
        market_info = session.get_instruments_info(category="linear", symbol=symbol)
        if market_info["retCode"] == 0:
            max_leverage = float(market_info["result"]["leverageFilter"]["maxLeverage"])
        else:
            raise Exception(f"Error fetching max leverage: {market_info['retMsg']}")

        # Step 4: Update leverage if not already max
        if current_buy_leverage < max_leverage or current_sell_leverage < max_leverage:
            response = session.set_leverage(
                category="linear",
                symbol=symbol,
                buyLeverage=str(max_leverage),
                sellLeverage=str(max_leverage)
            )
            if response["retCode"] == 0:
                print(f"Leverage for {symbol} updated to max ({max_leverage})")
            else:
                print(f"Failed to update leverage for {symbol}: {response['retMsg']}")

# Run the script
try:
    update_leverage_to_max()
except Exception as e:
    print(f"An error occurred: {e}")
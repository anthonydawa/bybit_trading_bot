from pybit.unified_trading import HTTP

def get_market_qty(symbol):
    """
    Fetches the quantity (size) of an open position for a given symbol.
    
    Parameters:
    - symbol: str, the trading pair symbol (e.g., "BTCUSDT")
    - api_key: str, Bybit API key
    - api_secret: str, Bybit API secret
    
    Returns:
    - float: The quantity of the open position, or 0 if no position exists.
    """
    session = HTTP(
        testnet=False,
        api_key='JAw1PgQ9yd2mN2kYtF',
        api_secret='KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM',
    )
    
    response = session.get_positions(category="linear", settleCoin="USDT")
    
    if response.get("retCode") != 0:
        print("Error fetching data:", response.get("retMsg"))
        return 0
    
    positions = response.get("result", {}).get("list", [])
    
    for position in positions:
        if position["symbol"] == symbol and float(position["size"]) > 0:
            return float(position["size"])
    
    return 0  # Return 0 if no matching position is found

if __name__ == "__main__":
    symbol = "KOMAUSDT"
    qty = get_market_qty(symbol)
    print(f"Market quantity for {symbol}: {qty}")

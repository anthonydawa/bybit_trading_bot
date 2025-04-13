import json
from pybit.unified_trading import HTTP

# Initialize Bybit session
session = HTTP()

def get_usdt_derivatives_markets(file_name="usdt_markets.json"):
    """
    Fetches all USDT derivatives futures markets on Bybit and saves them to a file.

    :param file_name: str - The name of the file to save the market data. Default is "usdt_markets.json".
    :return: None
    """
    try:
        usdt_markets = []
        next_page_cursor = None

        while True:
            # Fetch the list of symbols
            params = {"category": "linear"}
            if next_page_cursor:
                params["cursor"] = next_page_cursor

            response = session.get_instruments_info(**params)
            
            if "error" in response:
                raise Exception(response["error"])

            # Print the response result for debugging
            print(response["result"])

            # Filter for USDT markets
            usdt_markets.extend([
                market["symbol"] for market in response["result"]["list"]
                if "USDT" in market["symbol"]
            ])

            # Check if there is a "nextPageCursor" to handle pagination
            next_page_cursor = response["result"].get("nextPageCursor")
            if not next_page_cursor:
                break

        # Save to file
        with open(file_name, "w") as file:
            json.dump(usdt_markets, file, indent=4)

        print(f"USDT derivatives markets saved to {file_name}")

    except Exception as e:
        print(f"An error occurred: {e}")

# Example usage
if __name__ == "__main__":
    get_usdt_derivatives_markets()

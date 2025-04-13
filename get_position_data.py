import csv
from pybit.unified_trading import HTTP

def update_trades_csv(api_key="", api_secret="", filename="markets.csv"):
    """
    Fetches the latest open trades from Bybit and updates the specified CSV file.
    
    Parameters:
    - api_key: str, Bybit API key
    - api_secret: str, Bybit API secret
    - filename: str, the name of the CSV file to update (default: 'markets.csv')
    """
    # Initialize the API session
    session = HTTP(
        testnet=False,
        api_key=api_key,
        api_secret=api_secret,
    )

    # Fetch all positions with pagination
    def fetch_all_positions():
        positions = []
        next_page_cursor = None

        while True:
            response = session.get_positions(
                category="linear", 
                settleCoin="USDT", 
                cursor=next_page_cursor  # Provide cursor for the next page
            )

            if response.get("retCode") != 0:
                print("Error fetching data:", response.get("retMsg"))
                break

            # Append fetched positions to the list
            positions.extend(response.get("result", {}).get("list", []))

            # Check if there is a next page
            next_page_cursor = response.get("result", {}).get("nextPageCursor")
            if not next_page_cursor:
                break  # Exit loop if no more pages

        return positions

    # Extract relevant data for the CSV
    def extract_csv_data(all_positions):
        return [
            {
                "symbol": position["symbol"],
                "qty": position["size"],
                "position": "short" if position["side"].lower() == "sell" else "long",
                "status": "open",
                "stop_loss": 0,
                "mark_close": False,
                "reversed": False
            }
            for position in all_positions if float(position["size"]) > 0
        ]

    # Write data to the CSV file (clear and write)
    def write_to_csv(data):
        with open(filename, mode='w', newline='') as file:
            fieldnames = ["symbol", "qty", "position", "status", "stop_loss", "mark_close","reversed"]
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            for row in data:
                writer.writerow(row)
                print(f"Added row: {row}")

    # Fetch, extract, and save position data
    all_positions = fetch_all_positions()
    position_data = extract_csv_data(all_positions)
    write_to_csv(position_data)
    print("CSV cleared and updated successfully.")


if __name__ == "__main__":
    pass
    # session = HTTP(
    #     testnet=False,
    #     api_key="JAw1PgQ9yd2mN2kYtF",
    #     api_secret="KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM",
    # )
    # response = session.get_positions(category="linear", settleCoin="USDT")
    # print(response)

    
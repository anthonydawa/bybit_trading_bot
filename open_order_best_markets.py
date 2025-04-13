# import csv
# import os
# from order_utils import place_order

# def place_bulk_orders(num_markets, order_value, side, category="linear"):
#     """
#     Places bulk orders for the top N markets from a CSV file with specified USDT value and position.

#     :param num_markets: int - The number of markets to include in the orders.
#     :param order_value: float - The USDT value for each order.
#     :param side: str - The order side, "Buy" or "Sell".
#     :param category: str - The trading category, default is "linear".
#     :return: list - A list of results for each order placed.
#     """
#     # Determine file path based on side
#     if side == "Buy":
#         file_path = os.path.join("buy_trades", "long_trades.csv")
#     elif side == "Sell":
#         file_path = os.path.join("sell_trades", "short_trades.csv")
#     else:
#         return {"error": "Invalid side. Must be 'Buy' or 'Sell'."}

#     placed_orders = []
#     processed_markets = set()

#     try:
#         with open(file_path, mode="r") as file:
#             reader = csv.DictReader(file)
#             markets = []

#             # Read the markets from the CSV file
#             for row in reader:
#                 market = row["Market"]
#                 markets.append(market)

#             # Ensure no duplicates in the final selection and select the required number of markets
#             selected_markets = []
#             for market in markets:
#                 if market not in processed_markets:
#                     selected_markets.append(market)
#                     processed_markets.add(market)
#                 if len(selected_markets) == num_markets:
#                     break

#             # Check if enough markets were selected, otherwise continue fetching new markets from the CSV
#             if len(selected_markets) < num_markets:
#                 for row in markets:
#                     if row not in selected_markets:
#                         selected_markets.append(row)
#                     if len(selected_markets) == num_markets:
#                         break

#             # Place orders for the selected markets
#             for market in selected_markets:
#                 result = place_order(
#                     symbol=market,
#                     usdt=order_value,
#                     side=side,
#                     order_type="Market",
#                     time_in_force="PostOnly",
#                     order_filter="Order",
#                     category=category,
#                 )
#                 placed_orders.append({"market": market, "result": result})
#                 print(f"Order placed for {market}: {result}")

#     except FileNotFoundError:
#         print(f"File not found: {file_path}")
#         return {"error": "File not found."}
#     except Exception as e:
#         print(f"Error processing file: {str(e)}")
#         return {"error": str(e)}

#     return placed_orders

# # Example usage
# if __name__ == "__main__":
#     # Options for the bulk orders
#     top_markets = 10  # Number of markets
#     order_usdt_value = 100  # USDT value per order
#     order_side = "Buy"  # Buy or Sell
    
#     # Place the bulk orders
#     results = place_bulk_orders(
#         num_markets=top_markets,
#         order_value=order_usdt_value,
#         side=order_side,
#     )
#     print("Bulk order results:", results)



# import csv
# import os
# from pybit.unified_trading import HTTP
# from order_utils import place_order

# def place_bulk_orders(num_markets, order_value, side, category="linear"):
#     """
#     Places bulk orders for the top N markets from a CSV file with specified USDT value and position.

#     :param num_markets: int - The number of markets to include in the orders.
#     :param order_value: float - The USDT value for each order.
#     :param side: str - The order side, "Buy" or "Sell".
#     :param category: str - The trading category, default is "linear".
#     :return: list - A list of results for each order placed.
#     """
#     # API credentials for fetching current positions
#     API_KEY = "JAw1PgQ9yd2mN2kYtF"
#     API_SECRET = "KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM"

#     # Function to fetch current open positions
#     def get_open_positions():
#         session = HTTP(
#             testnet=False,
#             api_key=API_KEY,
#             api_secret=API_SECRET,
#         )
#         response = session.get_positions(category="linear", settleCoin="USDT")
#         if response.get("retCode") != 0:
#             print("Error fetching positions:", response.get("retMsg"))
#             return set()

#         positions = response.get("result", {}).get("list", [])
#         return {position["symbol"] for position in positions if float(position["size"]) > 0}

#     # Fetch current open positions
#     open_positions = get_open_positions()

#     # Determine file path based on side
#     if side == "Buy":
#         file_path = os.path.join("buy_trades", "long_trades.csv")
#     elif side == "Sell":
#         file_path = os.path.join("sell_trades", "short_trades.csv")
#     else:
#         return {"error": "Invalid side. Must be 'Buy' or 'Sell'."}

#     placed_orders = []
#     processed_markets = set()

#     try:
#         with open(file_path, mode="r") as file:
#             reader = csv.DictReader(file)
#             markets = []

#             # Read the markets from the CSV file
#             for row in reader:
#                 market = row["Market"]
#                 markets.append(market)

#             # Ensure no duplicates in the final selection and select the required number of markets
#             selected_markets = []
#             for market in markets:
#                 if market not in processed_markets and market not in open_positions:
#                     selected_markets.append(market)
#                     processed_markets.add(market)
#                 if len(selected_markets) == num_markets:
#                     break

#             # If fewer markets are selected, fetch additional ones
#             if len(selected_markets) < num_markets:
#                 for market in markets:
#                     if market not in selected_markets and market not in open_positions:
#                         selected_markets.append(market)
#                     if len(selected_markets) == num_markets:
#                         break

#             # Place orders for the selected markets
#             for market in selected_markets:
#                 result = place_order(
#                     symbol=market,
#                     usdt=order_value,
#                     side=side,
#                     order_type="Market",
#                     time_in_force="PostOnly",
#                     order_filter="Order",
#                     category=category,
#                 )
#                 placed_orders.append({"market": market, "result": result})
#                 print(f"Order placed for {market}: {result}")

#     except FileNotFoundError:
#         print(f"File not found: {file_path}")
#         return {"error": "File not found."}
#     except Exception as e:
#         print(f"Error processing file: {str(e)}")
#         return {"error": str(e)}

#     return placed_orders

# # Example usage
# if __name__ == "__main__":
#     # Options for the bulk orders
#     top_markets = 15  # Number of markets
#     order_usdt_value = 50  # USDT value per order
#     order_side = "Buy"  # Buy or Sell
    
#     # Place the bulk orders
#     results = place_bulk_orders(
#         num_markets=top_markets,
#         order_value=order_usdt_value,
#         side=order_side,
#     )
#     print("Bulk order results:", results)


import csv
import os
from pybit.unified_trading import HTTP
from order_utils import place_order

def place_bulk_orders(num_markets, order_value, side, category="linear"):
    """
    Places bulk orders for the top N markets from a CSV file with specified USDT value and position.

    :param num_markets: int - The number of markets to include in the orders.
    :param order_value: float - The USDT value for each order.
    :param side: str - The order side, "Buy" or "Sell".
    :param category: str - The trading category, default is "linear".
    :return: list - A list of results for each order placed.
    """
    # API credentials for fetching current positions
    API_KEY = "JAw1PgQ9yd2mN2kYtF"
    API_SECRET = "KlIYJUNGo5j5hBvhIGh956lAxxOs6EbfjmTM"

    # Function to fetch all open positions using pagination
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
                cursor=next_page_cursor,  # Provide cursor for the next page
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

        return {position["symbol"] for position in positions if float(position["size"]) > 0}

    # Fetch current open positions
    open_positions = fetch_all_positions()

    # Determine file path based on side
    if side == "Buy":
        file_path = os.path.join("buy_trades", "long_trades.csv")
    elif side == "Sell":
        file_path = os.path.join("sell_trades", "short_trades.csv")
    else:
        return {"error": "Invalid side. Must be 'Buy' or 'Sell'."}

    placed_orders = []
    processed_markets = set()

    try:
        with open(file_path, mode="r") as file:
            reader = csv.DictReader(file)
            markets = []

            # Read the markets from the CSV file
            for row in reader:
                market = row["Market"]
                markets.append(market)

            # Ensure no duplicates in the final selection and select the required number of markets
            selected_markets = []
            for market in markets:
                if market not in processed_markets and market not in open_positions:
                    selected_markets.append(market)
                    processed_markets.add(market)
                if len(selected_markets) == num_markets:
                    break

            # If fewer markets are selected, fetch additional ones
            if len(selected_markets) < num_markets:
                for market in markets:
                    if market not in selected_markets and market not in open_positions:
                        selected_markets.append(market)
                    if len(selected_markets) == num_markets:
                        break

            # Place orders for the selected markets
            for market in selected_markets:
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
    # Options for the bulk orders
    top_markets = 12  # Number of markets
    order_usdt_value = 100  # USDT value per order
    order_side = "Buy"  # Buy or Sell
    
    # Place the bulk orders
    results = place_bulk_orders(
        num_markets=top_markets,
        order_value=order_usdt_value,
        side=order_side,
    )
    print("Bulk order results:", results)

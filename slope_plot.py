import matplotlib.pyplot as plt
import numpy as np

def plot_line(slope, intercept, x_range=(-10, 10)):
    """
    Plots a line with a given slope and intercept.
    
    :param slope: float - The slope of the line.
    :param intercept: float - The y-intercept of the line.
    :param x_range: tuple - The range of x-values to plot. Default is from -10 to 10.
    """
    # Generate x values
    x = np.linspace(x_range[0], x_range[1], 100)

    # Calculate corresponding y values
    y = slope * x + intercept

    # Plot the line
    plt.plot(x, y, label=f'y = {slope}x + {intercept}')

    # Add labels and title
    plt.xlabel('X')
    plt.ylabel('Y')
    plt.title(f'Line with Slope = {slope} and Intercept = {intercept}')

    # Show the plot
    plt.legend()
    plt.grid(True)
    plt.show()

# Example usage
plot_line(2, 1.5)  # Line with slope 2 and intercept 1

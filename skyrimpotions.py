import csv
from itertools import combinations


def load_ingredients(filename):
    """
    Loads ingredient data from CSV formatted like:

    Name | Num | Effect | Mag | Dur
    """

    ingredients = {}

    with open(filename, newline='', encoding='utf-8') as file:
        reader = csv.DictReader(file, delimiter='\t')  # TAB separated

        for row in reader:
            name = row['Name'].strip()
            effect = row['Effect'].strip()

            if name not in ingredients:
                ingredients[name] = []

            ingredients[name].append(effect)

    return ingredients


def show_matches(ingredients, selected):
    if selected not in ingredients:
        print("\nIngredient not found.\n")
        return

    selected_effects = set(ingredients[selected])

    print("\n==============================")
    print(f"Ingredient: {selected}")
    print("==============================")

    print("\nEffects:")
    for effect in selected_effects:
        print(f" - {effect}")

    print("\nOther ingredients sharing effects:")

    for effect in selected_effects:
        matches = [
            ing for ing, effects in ingredients.items()
            if ing != selected and effect in effects
        ]

        if matches:
            print(f"\nEffect: {effect}")
            for m in matches:
                print(f"   - {m}")

    print("\n========================================")
    print("3-Ingredient Combos With 2+ Shared Effects")
    print("========================================\n")

    for combo in combinations(ingredients.keys(), 3):
        if selected not in combo:
            continue

        shared_effects = (
            set(ingredients[combo[0]]) &
            set(ingredients[combo[1]]) &
            set(ingredients[combo[2]])
        )

        if len(shared_effects) >= 2:
            print(f"{combo}")
            print(f"   shared effects: {', '.join(shared_effects)}\n")


def main():
    filename = r"C:\Users\michael\Downloads\ingredients.csv"

    try:
        ingredients = load_ingredients(filename)
    except FileNotFoundError:
        print("ingredients.csv not found.")
        return

    print("Skyrim Alchemy Helper\n")

    while True:
        user_input = input("Enter ingredient (or 'quit'): ").strip()

        if user_input.lower() == "quit":
            print("Goodbye.")
            break

        show_matches(ingredients, user_input)


if __name__ == "__main__":
    main()
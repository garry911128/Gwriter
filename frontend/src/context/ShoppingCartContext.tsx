import { createContext, useState, useContext } from "react";

type ShoppingCartProviderProps = {
    children: React.ReactNode;
};

type CartItems = {
    id: number;
    quantity: number;
};

type ShopingCartContext = {
    getItemQuantity: (id: number) => number;
    increaseCartQuantity: (id: number) => void;
    decreaseCartQuantity: (id: number) => void;
    removeFromCart: (id: number) => void;
};

const ShoppingCartContext = createContext({} as ShopingCartContext);

export function useShoppingCart() {
    return useContext(ShoppingCartContext);
}
export function ShoppingCartProvider({ children } : ShoppingCartProviderProps) {
    const [cartItems, setCartItems] = useState<CartItems[]>([]);
    
    function getItemQuantity(id: number) {
        return cartItems.find(item => item.id === id)?.quantity || 0;
    }

    function increaseCartQuantity(id: number) {
        setCartItems(currentItems => {
            if(currentItems.find(item => item.id === id) == null) {
                return [...currentItems, {id, quantity: 1}];
            }
            else{
                return currentItems.map(item =>{
                    if(item.id === id) {
                        return {...item, quantity: item.quantity + 1};
                    }
                    else{
                        return item
                    }
                })
            }
        })
    }

    function decreaseCartQuantity(id: number) {
        setCartItems(currentItems => {
            if(currentItems.find(item => item.id === id)?.quantity === 1) {
                return currentItems.filter(item => item.id !== id);
            }
            else{
                return currentItems.map(item =>{
                    if(item.id === id) {
                        return {...item, quantity: item.quantity - 1};
                    }
                    else{
                        return item
                    }
                })
            }
        })
    }

    function removeFromCart(id: number) {
        setCartItems(currentItems => {
            return currentItems.filter(item => item.id !== id);
        })
    }
    
    return( 
    <ShoppingCartContext.Provider 
        value=
        {
            {getItemQuantity,
            increaseCartQuantity,
            decreaseCartQuantity,
            removeFromCart
        }}>
        {children}
    </ShoppingCartContext.Provider>
)}
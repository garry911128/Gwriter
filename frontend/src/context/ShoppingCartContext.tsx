import { createContext, useState, useContext } from "react";
import { ShoppingCart } from "../components/ShoppingCart";

type ShoppingCartProviderProps = {
    children: React.ReactNode;
};

type CartItems = {
    id: number;
    quantity: number;
};

type ShopingCartContext = {
    openCart: () => void;
    closeCart: () => void;
    getItemQuantity: (id: number) => number;
    increaseCartQuantity: (id: number) => void;
    decreaseCartQuantity: (id: number) => void;
    removeFromCart: (id: number) => void;
    cartQuantity: number;
    cartItems: CartItems[];
};

const ShoppingCartContext = createContext({} as ShopingCartContext);

export function useShoppingCart() {
    return useContext(ShoppingCartContext);
}
export function ShoppingCartProvider({ children } : ShoppingCartProviderProps) {
    
    const [isOpen, setIsOpen] = useState(false);
    const [cartItems, setCartItems] = useState<CartItems[]>([]);

    const cartQuantity = cartItems.reduce(
        (quantity, item) => item.quantity + quantity,
        0
    )
    
    const openCart = () => setIsOpen(true);
    const closeCart = () => setIsOpen(false);

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
                        console.log(item);
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
                        console.log(item);
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
            {
                getItemQuantity,
                increaseCartQuantity,
                decreaseCartQuantity,
                removeFromCart,
                openCart,
                closeCart,
                cartItems,
                cartQuantity
            }
        }>
        {children}
        <ShoppingCart isOpen={isOpen}/>
    </ShoppingCartContext.Provider>
)}
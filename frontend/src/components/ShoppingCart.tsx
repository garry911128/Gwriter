import { Offcanvas, Stack } from "react-bootstrap";
import { useShoppingCart } from "../context/ShoppingCartContext";

type ShoppingCartProps = {
    isOpen: boolean;
};

export function ShoppingCart( { isOpen } : ShoppingCartProps) {
    const { closeCart, cartItems } = useShoppingCart();
    return (
        <Offcanvas show={isOpen} onHide={closeCart} placement="end">
            <Offcanvas.Header closeButton>
                <Offcanvas.Title>Cart</Offcanvas.Title> 
            </Offcanvas.Header>
            <Offcanvas.Body>
                <p>Cart Items</p>
                <Stack gap={3}>
                    {cartItems.map(item => (
                        
                    ))}
                </Stack>
            </Offcanvas.Body>
        </Offcanvas>
    )
}
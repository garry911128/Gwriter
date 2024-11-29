import { Button, Stack } from "react-bootstrap";
import { useShoppingCart } from "../context/ShoppingCartContext"
import storeItems from "../assets/data/books.json"
import { formatCurrency } from "../utilities/formatCurrency";

type CartItemProps = {
    id: number;
    quantity: number;
}

export function CartItem({id, quantity} : CartItemProps){
    const { removeFromCart } = useShoppingCart();
    const item = storeItems.find(i => i.id === id);
    if (item == null) {
        return null;
    }
    return (
        <Stack direction="horizontal" gap={3} className="d-flex align-items-center">
            <img src={item.img_url} alt={item.title} style={{width:"125px", height: "75px", objectFit: "cover"}} />
            <div className="me-auto">
                <div>
                    {item.title}{" "}{
                        quantity > 1 && 
                        <span className="text-muted" style={{fontSize: ".65rem"}}>
                            x{quantity}
                        </span>
                    }
                </div>
                <div className="text-muted" style={{ fontSize:".75rem" }}>
                    {formatCurrency(item.price)}
                </div>
            </div>
            <div>{formatCurrency(item.price * quantity)}</div>
            <Button variant="outline-danger" size="sm" onClick={
            () => removeFromCart(id)}>
                &times;    
            </Button>
        </Stack>
    )
}
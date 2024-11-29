import { Button, Card } from "react-bootstrap";
import { formatCurrency } from "../utilities/formatCurrency";
import { useShoppingCart } from "../context/ShoppingCartContext";

type StoreItemProps = {
    id: number;
    title: string;
    img_url: string;
    price: number;
    rating: number;
    description: string;
};

export function StoreItem({ id, title, img_url, price, rating, description } : StoreItemProps) {
    const { 
        getItemQuantity,
        increaseCartQuantity,
        decreaseCartQuantity,
        removeFromCart
    } = useShoppingCart();
    const quantity = getItemQuantity(id);

    return ( 
    <Card className="h-100">
        <Card.Img 
            variant="top"
            src={img_url}
            height="200px"
            style={{objectFit:"cover"}}
        />
        <Card.Body className="d-flex flex-column">
            <Card.Title className="d-flex 
            justify-content-space-between align-items-baseline mb-4">
                <span className="fs-2">{title}</span>
                <span className="ms-2 text-muted">{formatCurrency(price)}</span>
            </Card.Title>
            <div className="me-auto">
                {quantity === 0 ? (
                    <Button className="w-100" onClick={ () => increaseCartQuantity(id)}>+ Add To Cart</Button>
                ) : (
                    <div className="d-flex align-items-center justify-content-center" style={{gap:".5rem"}}>
                        <div className="d-flex align-items-center 
                        justify-content-center" style={{gap:".5rem"}}>
                            <Button onClick={ () => decreaseCartQuantity(id)}>-</Button>
                            <span className="fs-3">
                                {quantity}
                            </span>
                            in cart
                            <Button onClick={ () => increaseCartQuantity(id)}>+</Button>
                        </div>    
                        <Button variant="danger" size="sm" onClick={ () => removeFromCart(id)}>
                            Remove
                        </Button>
                    </div>
                )}
            </div>
            <Card.Text>{description}</Card.Text>
            <Card.Text>Price: ${price}</Card.Text>
            <Card.Text>Rating: {rating}</Card.Text>
        </Card.Body>
    </Card>
    );
}
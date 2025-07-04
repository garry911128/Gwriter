import { Button, Container, Nav,  Navbar as NavbarBs} from 'react-bootstrap'
import { NavLink } from 'react-router-dom'
import { useShoppingCart } from '../context/ShoppingCartContext'

export function Navbar() {

    const {openCart, cartQuantity} = useShoppingCart();

    return (
    <NavbarBs sticky="top" className="bg-white shadow-sm mb-3">
        <Container>
            <Nav className="me-auto">
                <Nav.Link to="/" as={NavLink}>
                    Home
                </Nav.Link>
                <Nav.Link to="/store" as={NavLink}>
                    Store
                </Nav.Link>
                <Nav.Link to="/edit" as={NavLink}>
                    Edit
                </Nav.Link>
                <Nav.Link to="/about" as={NavLink}>
                    About
                </Nav.Link>
            </Nav>
            { cartQuantity > 0 && (
            <Button 
                onClick={openCart}
                style={{width:"3rem", height:"3rem", position:"relative"}}
                variant="outline-primary"
                className="rounded-circle"
            >
                <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" 
                    viewBox="0 0 502 502" xmlSpace="preserve" fill="currentColor">
                <g>
                    <rect x="10" y="319" style={{fill:"#F0EFE4", width:"482", height:"36"}}/>
                    <g>
                        <rect x="189" y="112" style={{fill:"#F0EFE4", width:"62", height:"207"}}/>
                        <polygon style={{fill:"#F77E65"}} points="127,73 127,112 65,112 65,319 127,319 189,319 189,73 		"/>
                        <rect x="375" y="128" style={{fill:"#F0EFE4", width:"62", height:"191"}}/>
                        <polygon style={{fill:"#F77E65"}} points="313,86 313,166 251,166 251,319 313,319 375,319 375,86 		"/>
                        <g>
                            <path d="M492,309h-45V128c0-5.523-4.477-10-10-10h-52V86c0-5.523-4.477-10-10-10h-62c-5.523,0-10,4.477-10,10v70h-42v-44
                                c0-5.523-4.477-10-10-10h-52V73c0-5.523-4.477-10-10-10h-62c-5.523,0-10,4.477-10,10v29H65c-5.523,0-10,4.477-10,10v197H10
                                c-5.523,0-10,4.477-10,10v36c0,5.523,4.477,10,10,10h42v64c0,5.523,4.477,10,10,10s10-4.477,10-10v-64h420
                                c5.523,0,10-4.477,10-10v-36C502,313.477,497.523,309,492,309z M427,138v171h-42V138H427z M365,309h-42V96h42V309z M303,176v133
                                h-42V176H303z M241,309h-42V122h42V309z M179,309h-42V83h42V309z M75,122h42v187H75V122z M482,329v16H20v-16H482z"/>
                            <path d="M440,379c-5.523,0-10,4.477-10,10v40c0,5.523,4.477,10,10,10s10-4.477,10-10v-40C450,383.477,445.523,379,440,379z"/>
                            <path d="M96,140c-5.523,0-10,4.477-10,10v9c0,5.523,4.477,10,10,10s10-4.477,10-10v-9C106,144.477,101.523,140,96,140z"/>
                            <path d="M96,185c-5.523,0-10,4.477-10,10v90c0,5.523,4.477,10,10,10s10-4.477,10-10v-90C106,189.477,101.523,185,96,185z"/>
                            <path d="M282,217.533c5.523,0,10-4.477,10-10V202c0-5.523-4.477-10-10-10s-10,4.477-10,10v5.533
                                C272,213.056,276.477,217.533,282,217.533z"/>
                            <path d="M282,295c5.523,0,10-4.477,10-10v-43c0-5.523-4.477-10-10-10s-10,4.477-10,10v43C272,290.523,276.477,295,282,295z"/>
                        </g>
                    </g>
                </g>
                </svg>
                <div className="rounded-circle bg-danger d-flex justify-content-center 
                align-items-center"
                style={{ 
                    color:"white",
                    width:"1.5rem",
                    height:"1.5rem",
                    position:"absolute",
                    bottom:0,
                    right:0,
                    transform:"translate(25%, 25%)",
                }}>
                    {cartQuantity}
                </div>
            </Button>
            )}
        </Container>
    </NavbarBs>
    )
}
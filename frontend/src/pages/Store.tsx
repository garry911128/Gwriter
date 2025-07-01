import { Row, Col } from 'react-bootstrap'
import storeItems from '../assets/data/books.json'
import { StoreItem } from '../components/StoreItem'

export function Store() {
  return (
    <>
    <h1>Store</h1>
    <Row md={2} xs={1} lg={3} className="g-3">
    {storeItems.map((item) => (
      <Col key={item.title}>
        <StoreItem {...item} />
      </Col>
    ))}
    </Row>    
    </>
  )
}
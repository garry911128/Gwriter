
import './css/Edit.css';
import { useState, useRef } from 'react';

interface Card{
    id:number;
    name:string;
    image:string | null;
    content:string;
}

export function Edit() {    
    const [editCard, setEditCard] = useState(false);
    const [content, setContent] = useState("");
    const [imgPath, setImagePath] = useState<string|null>(null);
    const [name, setName] = useState("");
    const [cards, setCards] = useState<Card[]>([]);
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    let savedRange: Range | null = null;

    // 實時保存光標位置
    const saveCursorPosition = () => {
        const selection = window.getSelection();
        if (selection?.rangeCount) {
            savedRange = selection.getRangeAt(0);
        }
    };

    // 恢復光標位置
    const restoreCursorPosition = () => {
        const selection = window.getSelection();
        if (savedRange && selection) {
            contentRef.current?.focus(); 
            selection.removeAllRanges();
            selection.addRange(savedRange);
        }
    };

        const handleEditCard = () =>{
            setEditCard(true);
        }

    const handleshowCard = (card: Card) => {
        setSelectedCard(card);
        insertLink(card);
    };

    const handleCancelcard = () =>{
        setSelectedCard(null);
    }

    const handleImage = (event:React.ChangeEvent<HTMLInputElement>) =>{
        const file = event.target.files?.[0];
        if(file){
            setImagePath(URL.createObjectURL(file));
        }
    }

    const insertLink = (card:Card) =>{
        const contentElement = contentRef.current;
        if (!contentElement) return;

        restoreCursorPosition();

        const selection = window.getSelection();
        if(!selection?.rangeCount){
            contentElement.focus();
            return
        }
        const range = selection.getRangeAt(0);

        const link = document.createElement("a");
        link.href="#";// 避免頁面刷新
        link.textContent = card.name;
        link.className = "card-link";
        link.onclick = (e) => {
            e.preventDefault();
            handleshowCard(card);
        };
        range.deleteContents();
        range.insertNode(link);

        const space = document.createTextNode(" ");
        range.insertNode(space);
        range.setStartAfter(space);
        range.setEndAfter(space);
        selection.removeAllRanges();
        selection.addRange(range);
    };


    const handleNewCard = () => {
        if(!name){
            alert("請輸入名稱");
            return;
        }
        if(!content){
            alert("請輸入內容");
            return;
        }
        const Card = {
            id:Date.now(),
            name:name,
            image:imgPath || "",
            content:content,
        };


        setCards([...cards, Card]);

        insertLink(Card);

        setName("");
        setContent("");
        setImagePath("");
        setEditCard(false);
    }

    return (
        <div className = "Edit-container">
            <div className="sideMenu">
                <form>
                    <input type="search" placeholder="請輸入搜尋名稱" />
                </form>
                <button 
                    className="set-novel"
                >
                    +建立編輯頁
                </button>
                <nav>
                    <ul>
                        <li><button>資料夾</button></li>
                        <li><button>搜索</button></li>
                        <li><button>標記</button></li>
                        <li><button>歷史紀錄</button></li>
                        <li><button className="Show-Card" onClick={ () =>{
                            handleEditCard()
                        }
                        }>建立卡片</button></li>
                    </ul>
                </nav>
            </div>
            <div className="Edit">
                <div
                    ref={contentRef}
                    contentEditable
                    className='editText'
                    onMouseUp={saveCursorPosition}
                    onKeyUp={saveCursorPosition}
                >
                    <p></p>
                </div>
                <div className = "card-link">
                    <div className = 'cards'>
                        <div>
                            {cards.map((card) => (
                                <div key = {card.id} className='card-item'>
                                    <a 
                                        href='#'
                                        className='card-link'
                                        onClick={() => handleshowCard(card)}
                                        >
                                        {card.name}
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                {/* 顯示卡片 */}
                {selectedCard &&(
                    <div className="card-overlay" onClick={handleCancelcard}>
                        {/* stopPropagation 點擊事件不傳到父親 */}
                        <div className ="card-container" onClick={(e) => e.stopPropagation()}>
                            <div className ="card-img">
                                {selectedCard.image && (
                                    <img
                                        src={selectedCard.image}
                                        alt={selectedCard.name}
                                        style={{
                                            width: "450px",
                                            height: "375px",
                                            borderRadius: "8px"
                                        }}
                                    />
                                )}
                            </div>
                            <div className='card-text'>
                                <p>{selectedCard.content}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* 編輯卡片 */}
            <div className='edit-card'>
                {editCard && (
                    <div className = "card-overlay">
                        <div className ="card-editcontainer">
                            <button 
                            onClick={handleNewCard}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                saveCursorPosition();
                            }}
                            > 
                            保存
                            </button>
                            <div className ="card-image">
                                <input type="file" accept="image/*" onChange={handleImage}/>
                                {imgPath && <
                                    img 
                                    src = {imgPath} 
                                    alt="Upload"
                                    style={{ width: "450px", height: "375px", borderRadius: "8px" }}
                                    />}
                            </div>
                            <textarea
                            className ="card-namearea"
                            placeholder ="請輸入名稱"
                            value = {name}
                            onChange={(e) => setName(e.target.value)}
                            ></textarea>
                            <textarea
                            className ="card-textarea"
                            placeholder ="請輸入卡片內容"
                            value = {content}
                            onChange={(e) => setContent(e.target.value)}
                            ></textarea>
                            <div className ="card-edit">
                                <p>{content}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
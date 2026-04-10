from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from typing import Dict, List, Any
import json

BASE_DIR = Path(__file__).resolve().parent.parent
STUDENT_FILE = BASE_DIR / 'client' / 'index.html'
TEACHER_FILE = BASE_DIR / 'client' / 'teacher.html'
HOME_FILE = BASE_DIR / 'client' / 'home.html'
CLIENT_DIR = BASE_DIR / 'client'
DEFAULT_ROOM = 'classroom-101'

app = FastAPI(title='Wireless Lab Realtime Server')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.mount('/client/assets', StaticFiles(directory=CLIENT_DIR / 'assets'), name='client-assets')

rooms: Dict[str, Dict[str, Any]] = {}
clients: Dict[str, List[WebSocket]] = {}


def merge_board_row(board: List[dict], row: dict) -> List[dict]:
    key = (
        row.get('className', ''),
        row.get('groupName', ''),
        row.get('studentName', ''),
    )
    merged = list(board or [])
    for index, item in enumerate(merged):
        item_key = (
            item.get('className', ''),
            item.get('groupName', ''),
            item.get('studentName', ''),
        )
        if item_key == key:
            merged[index] = row
            return merged
    merged.append(row)
    return merged


def ensure_room(room: str):
    if room not in rooms:
        rooms[room] = {
            'topology': {'devices': [], 'links': []},
            'config': {},
            'teacher': {'mode': 'demo', 'fault': 'none', 'note': ''},
            'board': [],
        }
    if room not in clients:
        clients[room] = []


async def broadcast(room: str, payload: dict):
    dead = []
    for ws in clients.get(room, []):
        try:
            await ws.send_text(json.dumps(payload, ensure_ascii=False))
        except Exception:
            dead.append(ws)
    if dead:
        clients[room] = [ws for ws in clients[room] if ws not in dead]


def render_page(page_file: Path, route_role: str = '', auto_connect: bool = False) -> str:
    html = page_file.read_text(encoding='utf-8')
    return (html
        .replace('__ROUTE_ROLE__', route_role)
        .replace('__AUTO_CONNECT__', 'true' if auto_connect else 'false')
        .replace('__DEFAULT_ROOM__', DEFAULT_ROOM))


@app.get('/')
async def home():
    return HTMLResponse(HOME_FILE.read_text(encoding='utf-8'))


@app.get('/client')
async def client():
    return HTMLResponse(render_page(STUDENT_FILE, route_role='student', auto_connect=True))


@app.get('/teacher')
async def teacher():
    return HTMLResponse(render_page(TEACHER_FILE, route_role='teacher', auto_connect=True))


@app.get('/student')
async def student():
    return HTMLResponse(render_page(STUDENT_FILE, route_role='student', auto_connect=True))


@app.get('/health')
async def health():
    return {'ok': True}


@app.get('/state/{room}')
async def get_state(room: str):
    ensure_room(room)
    return rooms[room]


@app.post('/state/{room}')
async def save_state(room: str, state: dict):
    ensure_room(room)
    rooms[room] = state
    await broadcast(room, {'type': 'state_sync', 'room': room, 'payload': state})
    return {'ok': True}


@app.websocket('/ws/{room}/{role}/{client_id}')
async def websocket_endpoint(websocket: WebSocket, room: str, role: str, client_id: str):
    await websocket.accept()
    ensure_room(room)
    clients[room].append(websocket)
    await websocket.send_text(json.dumps({
        'type': 'state_sync',
        'room': room,
        'payload': rooms[room],
        'meta': {'role': role, 'client_id': client_id}
    }, ensure_ascii=False))
    await broadcast(room, {'type': 'presence', 'room': room, 'payload': {'client_id': client_id, 'role': role, 'online': True}})
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            mtype = msg.get('type')
            if mtype == 'state_sync':
                rooms[room] = msg.get('payload', rooms[room])
                await broadcast(room, {'type': 'state_sync', 'room': room, 'payload': rooms[room], 'meta': {'from': client_id, 'role': role}})
            elif mtype == 'board_update':
                rooms[room]['board'] = msg.get('payload', [])
                await broadcast(room, {'type': 'board_update', 'room': room, 'payload': rooms[room]['board'], 'meta': {'from': client_id, 'role': role}})
            elif mtype == 'board_submit':
                row = msg.get('payload', {})
                rooms[room]['board'] = merge_board_row(rooms[room].get('board', []), row)
                await broadcast(room, {'type': 'board_update', 'room': room, 'payload': rooms[room]['board'], 'meta': {'from': client_id, 'role': role}})
            elif mtype == 'control':
                await broadcast(room, {'type': 'control', 'room': room, 'payload': msg.get('payload', {}), 'meta': {'from': client_id, 'role': role}})
            elif mtype == 'ping':
                await websocket.send_text(json.dumps({'type': 'pong'}, ensure_ascii=False))
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in clients.get(room, []):
            clients[room].remove(websocket)
        await broadcast(room, {'type': 'presence', 'room': room, 'payload': {'client_id': client_id, 'role': role, 'online': False}})

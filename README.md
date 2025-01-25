# Project README

## Tech Stack
- **Frontend**: Vite + TypeScript
- **Backend**: Golang
- **Database**: MySQL

## Prerequisites
Ensure you have the following installed:
- Git
- Docker
- NPM
- Go
- MySQL

## How to Run

### Frontend
#### Setup Environment Variables
```sh
cd frontend
cp .example.env .env
```

- For local development:
  ```sh
  BACKEND_PATH='http://localhost:5000/api/v1'
  ```
- For Docker deployment:
  ```sh
  BACKEND_PATH='http://go-server:5000/api/v1'
  ```

#### Install Dependencies
```sh
npm install --legacy-peer-deps
```

#### Run Locally
```sh
cd frontend
npm run dev -- --open
```
The server will automatically reload after code changes.

---

### Backend
#### Setup Environment Variables
```sh
go mod download
```

#### Run the Server
```sh
go run cmd/main.go
```

---

## Code Formatting & Linting
### When to Check
- Before opening a pull request

### Format Code
```sh
npm run format
gofmt -w .
```

### Check Code Format
```sh
npm run lint
gofmt -l -d .
```

---

## Docker
### Start Containers
Run the project with Docker:
```sh
docker-compose up --detach --build
```

#### Run Only the Go Server
If `go.mod` or `go.sum` has changed, rebuild the Go server image:
```sh
docker-compose up go-server
```

#### Run Only MySQL
```sh
docker-compose up mysql-db
```

---

## Database Initialization
Place `.sql` files inside the `db` folder.

#### Access MySQL
If you have MySQL installed:
```sh
mysql -h localhost -P 3306 -u root -p
```

If you do not have MySQL installed:
```sh
docker exec -it <containerName> mysql -u root -p
```

---

## Shutdown Docker Containers
```sh
docker-compose down
```


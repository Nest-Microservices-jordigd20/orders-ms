# Orders Microservice

## Development environment

1. Clonate the repository
2. Install the dependencies
3. Create a `.env` based on the `.env.example` file.
4. Start the `PostgreSQL` database

```bash
# You can use the docker-compose to run the db
docker-compose up -d
```

## Production environment

Run the following command to build the Docker image:
```bash
docker build -f Dockerfile.prod -t orders-ms .
```

5. Synchronize the `Prisma` schema with the database

```bash
npx prisma migrate dev
```

6. Run the application

## Installation

```bash
$ pnpm install
```

## Running the app

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

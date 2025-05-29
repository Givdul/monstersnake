"use client";

import {useEffect, useRef, useState} from "react";

interface Position {
    x: number;
    y: number;
}

interface Enemy {
    position: Position;
    isStunned: boolean;
    lastCollisionTime: number;
}

interface Player {
    position: Position;
    isImmune: boolean;
    lastHitTime: number;
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const playerRef = useRef<Player>({
        position: {x: 0, y: 0},
        isImmune: false,
        lastHitTime: 0
    });
    const enemyRef = useRef<Enemy>({
        position: {x: 0, y: 0},
        isStunned: false,
        lastCollisionTime: 0
    });
    const pointRef = useRef<Position>({x: 0, y: 0});

    const boxSize = 20;
    const speed = 2;
    const enemySpeed = 0.5;
    const immunityDuration = 2000; // 2-second immunity
    const stunDuration = 2000; // 2 seconds stun

    const [canvasSize, setCanvasSize] = useState({
        width: 0,
        height: 0
    });
    const [health, setHealth] = useState(4);
    const [points, setPoints] = useState(0);
    const healthRef = useRef(4);
    const gameLoopRef = useRef<number>(0);
    const directionRef = useRef({dx: 0, dy: 0});

    const getRandomSpawnPosition = (width: number, height: number, excludeX: number, excludeY: number) => {
        const minDistanceFromExcluded = Math.min(width, height) / 2;
        let x, y, distance;

        do {
            x = Math.random() * (width - boxSize);
            y = Math.random() * (height - boxSize);
            const dx = x - excludeX;
            const dy = y - excludeY;
            distance = Math.sqrt(dx * dx + dy * dy);
        } while (distance < minDistanceFromExcluded);

        return {x, y};
    };

    useEffect(() => {
        const updateCanvasSize = () => {
            const availableWidth = window.innerWidth;
            const availableHeight = window.innerHeight - 50;
            const maxWidth = 430;
            const maxHeight = 932;
            const width = Math.min(availableWidth, maxWidth);
            const height = Math.min(availableHeight, maxHeight);
            setCanvasSize({
                width: Math.floor(width),
                height: Math.floor(height)
            });
        };

        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);
        return () => window.removeEventListener('resize', updateCanvasSize);
    }, []);

    useEffect(() => {
        healthRef.current = health;
    }, [health]);

    useEffect(() => {
        if (!canvasRef.current) return;

        const width = canvasRef.current.width;
        const height = canvasRef.current.height;

        playerRef.current = {
            position: {
                x: Math.floor(width / 2),
                y: Math.floor(height / 2)
            },
            isImmune: false,
            lastHitTime: 0
        };

        const enemyStartPosition = getRandomSpawnPosition(
            width,
            height,
            playerRef.current.position.x,
            playerRef.current.position.y
        );

        enemyRef.current = {
            position: enemyStartPosition,
            isStunned: false,
            lastCollisionTime: 0
        };

        pointRef.current = getRandomSpawnPosition(
            width,
            height,
            playerRef.current.position.x,
            playerRef.current.position.y
        );

        directionRef.current = {dx: speed, dy: 0};
    }, [canvasSize]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const checkCollision = (pos1: Position, pos2: Position) => {
            return Math.abs(pos1.x - pos2.x) < boxSize &&
                Math.abs(pos1.y - pos2.y) < boxSize;
        };

        const update = () => {
            if (healthRef.current <= 0) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "green";
                ctx.fillRect(
                    enemyRef.current.position.x,
                    enemyRef.current.position.y,
                    boxSize,
                    boxSize
                );
                gameLoopRef.current = requestAnimationFrame(update);
                return;
            }

            const nextX = playerRef.current.position.x + directionRef.current.dx;
            const nextY = playerRef.current.position.y + directionRef.current.dy;

            if ((nextX >= 0 && nextX + boxSize <= canvas.width) || directionRef.current.dx === 0) {
                playerRef.current.position.x = nextX;
            }
            if ((nextY >= 0 && nextY + boxSize <= canvas.height) || directionRef.current.dy === 0) {
                playerRef.current.position.y = nextY;
            }

            const currentTime = Date.now();
            if (playerRef.current.isImmune &&
                currentTime - playerRef.current.lastHitTime >= immunityDuration) {
                playerRef.current.isImmune = false;
            }

            if (enemyRef.current.isStunned) {
                if (currentTime - enemyRef.current.lastCollisionTime >= stunDuration) {
                    enemyRef.current.isStunned = false;
                }
            } else {
                const dx = playerRef.current.position.x - enemyRef.current.position.x;
                const dy = playerRef.current.position.y - enemyRef.current.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    enemyRef.current.position.x += (dx / distance) * enemySpeed;
                    enemyRef.current.position.y += (dy / distance) * enemySpeed;
                }
            }

            if (!enemyRef.current.isStunned &&
                !playerRef.current.isImmune &&
                checkCollision(playerRef.current.position, enemyRef.current.position)) {
                setHealth(prev => {
                    const newHealth = Math.max(0, prev - 1);
                    return newHealth;
                });

                playerRef.current.isImmune = true;
                playerRef.current.lastHitTime = currentTime;
                enemyRef.current.isStunned = true;
                enemyRef.current.lastCollisionTime = currentTime;
            }

            if (checkCollision(playerRef.current.position, pointRef.current)) {
                setPoints(prev => prev + 1);
                pointRef.current = getRandomSpawnPosition(canvas.width, canvas.height, playerRef.current.position.x, playerRef.current.position.y);
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = playerRef.current.isImmune ? "rgba(255, 255, 255, 0.5)" : "white";
            ctx.fillRect(
                playerRef.current.position.x,
                playerRef.current.position.y,
                boxSize,
                boxSize
            );

            ctx.fillStyle = enemyRef.current.isStunned ? "rgba(0, 255, 0, 0.5)" : "green";
            ctx.fillRect(
                enemyRef.current.position.x,
                enemyRef.current.position.y,
                boxSize,
                boxSize
            );

            ctx.fillStyle = "yellow";
            ctx.fillRect(
                pointRef.current.x,
                pointRef.current.y,
                boxSize,
                boxSize
            );

            gameLoopRef.current = requestAnimationFrame(update);
        };

        update();

        return () => {
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
            }
        };
    }, [canvasSize]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "W", "s", "S", "a", "A", "d", "D"].includes(event.key)) {
                event.preventDefault();
            }

            if (healthRef.current <= 0) {
                return;
            }

            switch (event.key) {
                case "ArrowUp":
                case "w":
                case "W":
                    directionRef.current = {dx: 0, dy: -speed};
                    break;
                case "ArrowDown":
                case "s":
                case "S":
                    directionRef.current = {dx: 0, dy: speed};
                    break;
                case "ArrowLeft":
                case "a":
                case "A":
                    directionRef.current = {dx: -speed, dy: 0};
                    break;
                case "ArrowRight":
                case "d":
                case "D":
                    directionRef.current = {dx: speed, dy: 0};
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            height: "100%",
            background: "#000",
        }}>
            <div style={{
                padding: "10px",
                color: "white",
                display: "flex",
                gap: "10px",
                justifyContent: "space-between",
                width: "100%",
                maxWidth: "430px"
            }}>
                <div style={{
                    fontSize: "16px",
                    fontWeight: "bold"
                }}>
                    Points: {points}
                </div>
                <div style={{
                    display: "flex",
                    gap: "10px"
                }}>
                    {[...Array(3)].map((_, i) => (
                        <div key={i} style={{
                            opacity: i < health ? 1 : 0.3,
                            width: "24px",
                            height: "24px",
                            backgroundColor: "red"
                        }}>
                        </div>
                    ))}
                </div>
            </div>
            <canvas
                ref={canvasRef}
                width={canvasSize.width}
                height={canvasSize.height}
                style={{
                    background: "#111",
                    maxWidth: "100%",
                    maxHeight: "100%",
                }}
            />
            {health <= 0 && (
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    color: "red",
                    fontSize: "32px",
                    fontWeight: "bold"
                }}>
                    GAME OVER
                </div>
            )}
        </div>
    );
}
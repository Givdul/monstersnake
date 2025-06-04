"use client";

import {useEffect, useRef, useState} from "react";

interface Position {
    x: number;
    y: number;
}

interface EnemyType {
    color: string;
    speed: number;
}

interface Enemy {
    position: Position;
    isStunned: boolean;
    lastCollisionTime: number;
    type: EnemyType;
    canAttack: boolean;
}

interface Player {
    position: Position;
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const playerRef = useRef<Player>({
        position: {x: 0, y: 0}
    });
    const enemiesRef = useRef<Enemy[]>([]);
    const pointRef = useRef<Position>({x: 0, y: 0});

    const boxSize = 50;
    const speed = 2;
    const stunDuration = 2000;

    const basicEnemy: EnemyType = {
        color: "green",
        speed: 0.5
    };

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

        setPoints(0);

        playerRef.current = {
            position: {
                x: Math.floor(width / 2),
                y: Math.floor(height / 2)
            }
        };

        const enemyStartPosition = getRandomSpawnPosition(
            width,
            height,
            playerRef.current.position.x,
            playerRef.current.position.y
        );

        enemiesRef.current = [{
            position: enemyStartPosition,
            isStunned: false,
            lastCollisionTime: 0,
            type: basicEnemy,
            canAttack: true
        }];

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

        const moveWithCollisionCheck = (enemy: Enemy, newX: number, newY: number) => {
            const wouldCollide = enemiesRef.current.some(otherEnemy => {
                if (otherEnemy === enemy) return false;

                const dx = newX - otherEnemy.position.x;
                const dy = newY - otherEnemy.position.y;
                return Math.sqrt(dx * dx + dy * dy) < boxSize;
            });

            if (!wouldCollide) {
                enemy.position.x = newX;
                enemy.position.y = newY;
            }
        };

        const update = () => {
            // Clear canvas once at the beginning
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (healthRef.current <= 0) {
                // Draw in the same order even in game over state
                ctx.fillStyle = "yellow";
                ctx.fillRect(
                    pointRef.current.x,
                    pointRef.current.y,
                    boxSize,
                    boxSize
                );

                ctx.fillStyle = "white";
                ctx.fillRect(
                    playerRef.current.position.x,
                    playerRef.current.position.y,
                    boxSize,
                    boxSize
                );

                enemiesRef.current.forEach(enemy => {
                    ctx.fillStyle = enemy.type.color;
                    ctx.fillRect(
                        enemy.position.x,
                        enemy.position.y,
                        boxSize,
                        boxSize
                    );
                });
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

            enemiesRef.current = enemiesRef.current.map(enemy => {
                if (enemy.isStunned) {
                    if (currentTime - enemy.lastCollisionTime >= stunDuration) {
                        enemy.isStunned = false;
                        enemy.canAttack = true;
                    }
                    return enemy;
                }

                const dx = playerRef.current.position.x - enemy.position.x;
                const dy = playerRef.current.position.y - enemy.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    const newX = enemy.position.x + (dx / distance) * enemy.type.speed;
                    const newY = enemy.position.y + (dy / distance) * enemy.type.speed;
                    moveWithCollisionCheck(enemy, newX, newY);
                }

                if (enemy.canAttack && !enemy.isStunned && checkCollision(playerRef.current.position, enemy.position)) {
                    setHealth(prev => Math.max(0, prev - 1));
                    enemy.isStunned = true;
                    enemy.canAttack = false;
                    enemy.lastCollisionTime = currentTime;
                }

                return enemy;
            });

            if (checkCollision(playerRef.current.position, pointRef.current)) {
                const newPoints = points + 1;
                setPoints(newPoints);

                if (newPoints % 10 === 0) {
                    const newEnemyPosition = getRandomSpawnPosition(
                        canvas.width,
                        canvas.height,
                        playerRef.current.position.x,
                        playerRef.current.position.y
                    );
                    enemiesRef.current = [...enemiesRef.current, {
                        position: newEnemyPosition,
                        isStunned: false,
                        lastCollisionTime: 0,
                        type: basicEnemy,
                        canAttack: true
                    }];
                }

                pointRef.current = getRandomSpawnPosition(
                    canvas.width,
                    canvas.height,
                    playerRef.current.position.x,
                    playerRef.current.position.y
                );
            }

            // Draw everything in order
            // 1. Point (bottom layer)
            ctx.fillStyle = "yellow";
            ctx.fillRect(
                pointRef.current.x,
                pointRef.current.y,
                boxSize,
                boxSize
            );

            // 2. Player (middle layer)
            ctx.fillStyle = "white";
            ctx.fillRect(
                playerRef.current.position.x,
                playerRef.current.position.y,
                boxSize,
                boxSize
            );

            // 3. Enemies (top layer)
            enemiesRef.current.forEach(enemy => {
                ctx.fillStyle = enemy.isStunned ? `rgba(0, 255, 0, 0.5)` : enemy.type.color;
                ctx.fillRect(
                    enemy.position.x,
                    enemy.position.y,
                    boxSize,
                    boxSize
                );
            });

            gameLoopRef.current = requestAnimationFrame(update);
        };

        update();

        return () => {
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
            }
        };
    }, [canvasSize, points]);

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
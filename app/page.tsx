"use client";

import {useEffect, useRef, useState} from "react";

interface Position {
    x: number;
    y: number;
}

// Define possible enemy behaviors
enum EnemyBehavior {
    FOLLOW_PLAYER, // Basic enemy that follows player
    RUSH_STRAIGHT, // Enemy that locks on and rushes in straight line
    // Extend more behaviors here
}

enum RusherPhase {
    STUNNED,
    TARGETING,
    RUSHING
}

interface EnemyType {
    color: string;
    speed: number;
    behavior: EnemyBehavior;
    rushDelay?: number;
    targetingDuration?: number;
    targetDirection?: { x: number; y: number }; // Add this if missing
}

interface Enemy {
    position: Position;
    isStunned: boolean;
    lastCollisionTime: number;
    lastAttackTime?: number;
    type: EnemyType;
    canAttack: boolean;
    rusherPhase?: RusherPhase;
    phaseStartTime?: number;
    targetDirection?: Position;
}

interface Player {
    position: Position;
}



// Define different enemy types
const enemyTypes = {
    basic: {
        color: "green",
        speed: 0.5,
        behavior: EnemyBehavior.FOLLOW_PLAYER
    },
    rusher: {
        color: "red",
        speed: 6,
        behavior: EnemyBehavior.RUSH_STRAIGHT,
        rushDelay: 1500,
        targetingDuration: 2000
    }
} as const;

export default function Home() {
    const immunityDuration = 500; // 500 ms = half a second
    const lastPlayerHitTime = useRef(0);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const playerRef = useRef<Player>({
        position: {x: 0, y: 0}
    });
    const enemiesRef = useRef<Enemy[]>([]);
    const pointRef = useRef<Position>({x: 0, y: 0});

    const boxSize = 50;
    const speed = 2;
    const stunDuration = 2000;

    const [canvasSize, setCanvasSize] = useState({
        width: 0,
        height: 0
    });
    const [health, setHealth] = useState(4);
    const [points, setPoints] = useState(0);
    const healthRef = useRef(4);
    const gameLoopRef = useRef<number>(0);
    const directionRef = useRef({dx: 0, dy: 0});

    // Function to get random enemy type
    const getRandomEnemyType = (): EnemyType => {
        const types = [enemyTypes.basic, enemyTypes.rusher];
        return types[Math.floor(Math.random() * types.length)];
    };

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

        // Initialize enemies
        enemiesRef.current = [{
            position: enemyStartPosition,
            isStunned: false,
            lastCollisionTime: 0,
            type: {
                ...enemyTypes.basic
            },
            canAttack: true,
            rusherPhase: RusherPhase.TARGETING,
            phaseStartTime: Date.now()
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

        const checkCollision = (pos1: Position | undefined, pos2: Position | undefined): boolean => {
            if (!pos1 || !pos2) return false;
            return Math.abs(pos1.x - pos2.x) < boxSize &&
                Math.abs(pos1.y - pos2.y) < boxSize;
        };

        const moveWithCollisionCheck = (enemy: Enemy, newX: number, newY: number) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const wouldHitWall =
                newX < 0 ||
                newX + boxSize > canvas.width ||
                newY < 0 ||
                newY + boxSize > canvas.height;

            if (wouldHitWall) {
                if (newX < 0) enemy.position.x = 1;
                if (newX + boxSize > canvas.width) enemy.position.x = canvas.width - boxSize - 1;
                if (newY < 0) enemy.position.y = 1;
                if (newY + boxSize > canvas.height) enemy.position.y = canvas.height - boxSize - 1;

                if (enemy.type.behavior === EnemyBehavior.RUSH_STRAIGHT) {
                    enemy.rusherPhase = RusherPhase.TARGETING;
                    enemy.phaseStartTime = Date.now();
                }
                return;
            }

            // Only check collisions for basic enemies
            if (enemy.type.behavior === EnemyBehavior.FOLLOW_PLAYER) {
                const wouldCollideWithEnemy = enemiesRef.current.some(otherEnemy => {
                    if (otherEnemy === enemy) return false;
                    // Only consider collision with other basic enemies
                    if (otherEnemy.type.behavior !== EnemyBehavior.FOLLOW_PLAYER) return false;
                    return Math.abs(newX - otherEnemy.position.x) < boxSize &&
                        Math.abs(newY - otherEnemy.position.y) < boxSize;
                });

                if (!wouldCollideWithEnemy) {
                    enemy.position.x = newX;
                    enemy.position.y = newY;
                }
            } else {
                // Rushers move freely without collision checks
                enemy.position.x = newX;
                enemy.position.y = newY;
            }
        };

        const update = () => {
            if (!canvasRef.current) return;
            const canvas = canvasRef.current;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (healthRef.current <= 0) {
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

            const timeNow = Date.now();

            enemiesRef.current = enemiesRef.current.filter((enemy): enemy is Enemy => enemy !== undefined).map(enemy => {
                if (enemy.isStunned) {
                    if (timeNow - enemy.lastCollisionTime >= stunDuration) {
                        enemy.isStunned = false;
                        enemy.canAttack = true;
                    }
                    return enemy;
                }

                switch (enemy.type.behavior) {
                    case EnemyBehavior.FOLLOW_PLAYER:
                        const dx = playerRef.current.position.x - enemy.position.x;
                        const dy = playerRef.current.position.y - enemy.position.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance > 0) {
                            const newX = enemy.position.x + (dx / distance) * enemy.type.speed;
                            const newY = enemy.position.y + (dy / distance) * enemy.type.speed;
                            moveWithCollisionCheck(enemy, newX, newY);
                        }
                        break;

                    case EnemyBehavior.RUSH_STRAIGHT:
                        if (!enemy.rusherPhase) {
                            enemy.rusherPhase = RusherPhase.TARGETING;
                            enemy.phaseStartTime = timeNow;
                        }

                        if (enemy.rusherPhase === RusherPhase.TARGETING) {
                            const dx = playerRef.current.position.x - enemy.position.x;
                            const dy = playerRef.current.position.y - enemy.position.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            enemy.targetDirection = {
                                x: dx / distance,
                                y: dy / distance
                            };

                            if (enemy.phaseStartTime && timeNow - enemy.phaseStartTime >= enemy.type.targetingDuration!) {
                                enemy.rusherPhase = RusherPhase.RUSHING;
                                enemy.phaseStartTime = timeNow;
                            }
                        } else if (enemy.rusherPhase === RusherPhase.RUSHING && enemy.targetDirection) {
                            const newX = enemy.position.x + enemy.targetDirection.x * enemy.type.speed;
                            const newY = enemy.position.y + enemy.targetDirection.y * enemy.type.speed;
                            moveWithCollisionCheck(enemy, newX, newY);
                        }
                        break;
                }

                if (!enemy.isStunned && checkCollision(playerRef.current.position, enemy.position)) {
                    const currentTime = Date.now();
                    if (currentTime - lastPlayerHitTime.current >= immunityDuration) {
                        setHealth(prev => Math.max(0, prev - 1));
                        lastPlayerHitTime.current = currentTime;
                        enemy.isStunned = true;
                    }
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

                    const newEnemy: Enemy = {
                        position: newEnemyPosition,
                        isStunned: false,
                        lastCollisionTime: 0,
                        type: {
                            ...getRandomEnemyType()
                        },
                        canAttack: true,
                        rusherPhase: undefined,
                        phaseStartTime: undefined
                    };

                    if (newEnemy.type.behavior === EnemyBehavior.RUSH_STRAIGHT) {
                        newEnemy.rusherPhase = RusherPhase.TARGETING;
                        newEnemy.phaseStartTime = Date.now();
                    }

                    enemiesRef.current = [...enemiesRef.current, newEnemy];
                }

                pointRef.current = getRandomSpawnPosition(
                    canvas.width,
                    canvas.height,
                    playerRef.current.position.x,
                    playerRef.current.position.y
                );
            }

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
-- 데이터베이스 초기화
DROP DATABASE IF EXISTS furnhub;
CREATE DATABASE furnhub DEFAULT CHARSET utf8mb4;
USE furnhub;

-- 테이블 가구 카테고리
CREATE TABLE furniture_categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 테이블 에셋 가구
CREATE TABLE assets_furniture (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id BIGINT NOT NULL,
    folder_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES furniture_categories(id) ON DELETE CASCADE
);

-- 테이블 에셋 바닥재
CREATE TABLE assets_floor (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    texture_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 테이블 룸 (기존 프로젝트를 룸으로 변경)
CREATE TABLE rooms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 테이블 룸 바닥재
CREATE TABLE room_floor (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    assets_floor_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (assets_floor_id) REFERENCES assets_floor(id) ON DELETE CASCADE
);

-- 테이블 벽
CREATE TABLE walls (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    start_x DOUBLE NOT NULL,
    start_y DOUBLE NOT NULL,
    end_x DOUBLE NOT NULL,
    end_y DOUBLE NOT NULL,
    thickness DOUBLE DEFAULT 10.0,
    color VARCHAR(7) DEFAULT '#000000',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- 테이블 닫힌 공간
CREATE TABLE closed_areas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    area DOUBLE NOT NULL,
    center_x DOUBLE,
    center_y DOUBLE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- 테이블 룸 가구
CREATE TABLE room_furniture (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    position_x DOUBLE NOT NULL,
    position_y DOUBLE NOT NULL,
    rotation DOUBLE DEFAULT 0,
    scale_x DOUBLE DEFAULT 1.0,
    scale_y DOUBLE DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- 에셋 바닥재 삽입
INSERT INTO assets_floor (name, texture_path) VALUES
('Wood', '/assets/floor/wood.png');

-- 가구 카테고리 삽입
INSERT INTO furniture_categories (name) VALUES
('Chair');

-- 에셋 가구 삽입
INSERT INTO assets_furniture (name, category_id, folder_name) VALUES
('Chair Model 1', 1, '/assets/asset_chair_1');

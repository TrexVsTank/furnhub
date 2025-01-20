package com.furnhub.repository;

import com.furnhub.entity.Wall;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WallRepository extends JpaRepository<Wall, Long> {
    List<Wall> findByRoomId(Long roomId); // roomId로 검색
}

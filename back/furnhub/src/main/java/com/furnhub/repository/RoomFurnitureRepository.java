package com.furnhub.repository;

import com.furnhub.entity.RoomFurniture;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RoomFurnitureRepository extends JpaRepository<RoomFurniture, Long> {
    List<RoomFurniture> findByRoomId(Long roomId); // roomId로 검색
}

package com.furnhub.repository;

import com.furnhub.entity.RoomFloor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RoomFloorRepository extends JpaRepository<RoomFloor, Long> {
    List<RoomFloor> findByRoomId(Long roomId); // 추가
}
